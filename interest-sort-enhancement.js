(() => {
  const COUNT_COLUMNS = Array.isArray(window.INTEREST_COUNT_COLUMNS)
    ? window.INTEREST_COUNT_COLUMNS
    : ["관심도", "관심도 집계", "관심수", "하트수", "관심도 수치"];
  let refreshTimer = null;
  let isSorting = false;
  let projectInterestMap = null;

  document.addEventListener("DOMContentLoaded", init);
  if (document.readyState !== "loading") init();

  function init() {
    addInterestSortOption();
    patchSortHelp();
    refreshInterestData();
    document.addEventListener("click", () => setTimeout(() => refreshInterestData(), 250));
    document.addEventListener("change", () => setTimeout(() => refreshInterestData(), 250));
    observeLists();
  }

  function addInterestSortOption() {
    const sortSelect = document.getElementById("sortSelect");
    if (!sortSelect || sortSelect.querySelector('option[value="interest:desc"]')) return;
    const option = document.createElement("option");
    option.value = "interest:desc";
    option.textContent = "관심도순";
    sortSelect.insertBefore(option, sortSelect.firstElementChild);
    sortSelect.addEventListener("change", () => {
      if (sortSelect.value === "interest:desc") {
        refreshInterestData();
        setTimeout(applyInterestSort, 200);
      }
    });
  }

  function patchSortHelp() {
    const sortSelect = document.getElementById("sortSelect");
    if (!sortSelect) return;
    const field = sortSelect.closest(".field") || document;
    const label = field.querySelector('label[for="sortSelect"]') || document.querySelector('label[for="sortSelect"]');
    if (!label) return;

    let labelRow = field.querySelector(".sort-label-row");
    if (!labelRow) {
      labelRow = document.createElement("div");
      labelRow.className = "sort-label-row";
      label.parentNode.insertBefore(labelRow, label);
      labelRow.appendChild(label);
    } else if (!labelRow.contains(label)) {
      labelRow.prepend(label);
    }

    let help = field.querySelector(".sort-help");
    if (!help) {
      help = document.createElement("button");
      help.className = "sort-help";
      help.textContent = "?";
      labelRow.appendChild(help);
    }
    help.type = "button";
    help.textContent = "?";
    help.setAttribute(
      "aria-label",
      "관심도순은 스프레드시트 관심도 집계 열에 반영된 수치를 기준으로 정렬합니다. 방금 누른 값은 이 브라우저에서 즉시 보이지만 전체 집계는 다음 캐시 동기화 후 반영됩니다.",
    );
  }

  function refreshInterestData() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async () => {
      await hydrateProjectListCounts();
      applyInterestSort();
    }, 120);
  }

  async function hydrateProjectListCounts() {
    const projectRows = [...document.querySelectorAll("#projectBody tr")];
    if (!projectRows.length) return;
    const map = await getProjectInterestMap();
    projectRows.forEach((row) => {
      const projectId = getProjectSheetIdFromRow(row);
      row.dataset.interestCount = String(map.get(projectId) || 0);
    });
  }

  async function getProjectInterestMap() {
    if (projectInterestMap) return projectInterestMap;
    projectInterestMap = new Map();
    try {
      const [articles, projects] = await Promise.all([fetchJson("./data/articles.json"), fetchJson("./data/projects.json")]);
      const articleCounts = new Map(
        articles
          .map((row) => [clean(row["기사 고유값"]), getSheetCount(row)])
          .filter(([id]) => id),
      );
      projects.forEach((project) => {
        const projectId = clean(project["프로젝트 고유값"]);
        const representativeArticleId = clean(project["대표 기사 고유값"]);
        if (!projectId) return;
        projectInterestMap.set(projectId, articleCounts.get(representativeArticleId) || 0);
      });
    } catch (error) {
      console.info("Project interest cache read skipped:", error);
    }
    return projectInterestMap;
  }

  async function fetchJson(path) {
    const response = await fetch(path, { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    return Array.isArray(payload) ? payload : payload?.articles || payload?.projects || [];
  }

  function applyInterestSort() {
    const sortSelect = document.getElementById("sortSelect");
    if (!sortSelect || sortSelect.value !== "interest:desc" || isSorting) return;
    isSorting = true;
    try {
      sortMarketRowsByInterest();
      sortProjectRowsByInterest();
    } finally {
      requestAnimationFrame(() => {
        isSorting = false;
      });
    }
  }

  function sortMarketRowsByInterest() {
    const tbody = document.getElementById("resultBody");
    if (!tbody) return;
    const groups = [];
    let currentGroup = null;
    [...tbody.children].forEach((row) => {
      if (!row.classList.contains("detail-row")) {
        currentGroup = { row, details: [] };
        groups.push(currentGroup);
      } else if (currentGroup) {
        currentGroup.details.push(row);
      }
    });
    if (!groups.length) return;

    const currentSignature = groups.map((group) => getStableRowKey(group.row)).join("|");
    const sortedGroups = [...groups].sort((a, b) => {
      const interestDiff = getRowInterestCount(b.row) - getRowInterestCount(a.row);
      return interestDiff || getStableRowKey(a.row).localeCompare(getStableRowKey(b.row), "ko");
    });
    const sortedSignature = sortedGroups.map((group) => getStableRowKey(group.row)).join("|");
    if (currentSignature === sortedSignature) return;

    const fragment = document.createDocumentFragment();
    sortedGroups.forEach((group) => {
      fragment.appendChild(group.row);
      group.details.forEach((detail) => fragment.appendChild(detail));
    });
    tbody.appendChild(fragment);
  }

  function sortProjectRowsByInterest() {
    const tbody = document.getElementById("projectBody");
    if (!tbody) return;
    const rows = [...tbody.querySelectorAll("tr")];
    if (!rows.length) return;
    const currentSignature = rows.map(getStableRowKey).join("|");
    const sortedRows = [...rows].sort((a, b) => {
      const interestDiff = Number(b.dataset.interestCount || 0) - Number(a.dataset.interestCount || 0);
      return interestDiff || getStableRowKey(a).localeCompare(getStableRowKey(b), "ko");
    });
    const sortedSignature = sortedRows.map(getStableRowKey).join("|");
    if (currentSignature === sortedSignature) return;

    const fragment = document.createDocumentFragment();
    sortedRows.forEach((row) => fragment.appendChild(row));
    tbody.appendChild(fragment);
  }

  function getRowInterestCount(row) {
    const button = row.querySelector(".interest-button");
    if (!button) return Number(row.dataset.interestCount || 0);
    const text = button.querySelector(".interest-count")?.textContent || "0";
    const value = Number(String(text).replace(/[^0-9.-]/g, ""));
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }

  function getStableRowKey(row) {
    const link = row.querySelector(".title-link, .project-title-cell a, .market-title-cell a");
    return clean(link?.getAttribute("href") || link?.textContent || row.textContent).slice(0, 160);
  }

  function getProjectSheetIdFromRow(row) {
    const link = row.querySelector(".project-title-cell a[href]");
    const url = new URL(link?.getAttribute("href") || "", window.location.href);
    return clean(url.searchParams.get("id"));
  }

  function getSheetCount(row) {
    for (const column of COUNT_COLUMNS) {
      const value = Number(String(row?.[column] || "").replace(/[^0-9.-]/g, ""));
      if (Number.isFinite(value) && value > 0) return value;
    }
    return 0;
  }

  function observeLists() {
    ["resultBody", "projectBody"].forEach((id) => {
      const target = document.getElementById(id);
      if (!target || target.dataset.interestSortObserved === "true") return;
      target.dataset.interestSortObserved = "true";
      new MutationObserver((mutations) => {
        if (isSorting) return;
        const hasMeaningfulChange = mutations.some((mutation) =>
          [...mutation.addedNodes, ...mutation.removedNodes].some((node) => node.nodeType === Node.ELEMENT_NODE),
        );
        if (hasMeaningfulChange) refreshInterestData();
      }).observe(target, { childList: true });
    });
  }

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }
})();