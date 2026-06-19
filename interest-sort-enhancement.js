(() => {
  const API_ENDPOINT = String(window.INTEREST_API_ENDPOINT || "https://icak-interest-api.icak-mena-div.workers.dev").replace(/\/$/, "");
  const STORAGE_KEY = "icakInterestLocalCounts";
  let refreshTimer = null;

  document.addEventListener("DOMContentLoaded", init);
  if (document.readyState !== "loading") init();

  function init() {
    addInterestSortOption();
    patchSortHelp();
    refreshInterestData();
    document.addEventListener("click", () => setTimeout(refreshInterestData, 350));
    document.addEventListener("change", () => setTimeout(refreshInterestData, 350));
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
        setTimeout(applyInterestSort, 300);
      }
    });
  }

  function patchSortHelp() {
    const sortSelect = document.getElementById("sortSelect");
    if (!sortSelect) return;

    let help = document.querySelector(".sort-help");
    if (!help) {
      const label = document.querySelector('label[for="sortSelect"]');
      if (!label) return;
      help = document.createElement("span");
      help.className = "sort-help";
      help.tabIndex = 0;
      help.textContent = "?";
      label.insertAdjacentElement("afterend", help);
    }

    help.setAttribute(
      "aria-label",
      "관심도순은 하트 관심 수가 높은 항목을 우선 표시합니다. 시장 모니터링의 중요도순은 국가·섹터별 진출 실적과 우리 기업 관심도를 함께 고려한 AI 판단값입니다.",
    );
  }

  async function refreshInterestData() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async () => {
      await hydrateProjectListCounts();
      applyInterestSort();
    }, 80);
  }

  async function hydrateProjectListCounts() {
    const projectRows = [...document.querySelectorAll("#projectBody tr")];
    if (!projectRows.length || !API_ENDPOINT) return;

    const ids = projectRows.map(getProjectIdFromRow).filter(Boolean);
    if (!ids.length) return;

    try {
      const visitorId = getVisitorId();
      const query = `/counts?ids=${encodeURIComponent([...new Set(ids)].join(","))}&visitorId=${encodeURIComponent(visitorId)}&_=${Date.now()}`;
      const payload = await fetch(`${API_ENDPOINT}${query}`, { cache: "no-store" }).then((response) => response.json());
      const countMap = new Map((payload.items || []).map((item) => [String(item.articleId), Number(item.count || 0)]));
      projectRows.forEach((row) => {
        const id = getProjectIdFromRow(row);
        row.dataset.interestCount = String(countMap.get(id) || 0);
      });
    } catch (error) {
      console.info("Project interest sort count fetch skipped:", error);
    }
  }

  function applyInterestSort() {
    const sortSelect = document.getElementById("sortSelect");
    if (!sortSelect || sortSelect.value !== "interest:desc") return;

    sortMarketRowsByInterest();
    sortProjectRowsByInterest();
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

    groups
      .sort((a, b) => getRowInterestCount(b.row) - getRowInterestCount(a.row))
      .forEach((group) => {
        tbody.appendChild(group.row);
        group.details.forEach((detail) => tbody.appendChild(detail));
      });
  }

  function sortProjectRowsByInterest() {
    const tbody = document.getElementById("projectBody");
    if (!tbody) return;
    [...tbody.querySelectorAll("tr")]
      .sort((a, b) => Number(b.dataset.interestCount || 0) - Number(a.dataset.interestCount || 0))
      .forEach((row) => tbody.appendChild(row));
  }

  function getRowInterestCount(row) {
    const button = row.querySelector(".interest-button");
    if (!button) return 0;
    const id = button.dataset.articleId;
    const serverText = button.querySelector(".interest-count")?.textContent || "0";
    const serverValue = Number(String(serverText).replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(serverValue)) return Math.max(0, serverValue);
    return getStoredCount(id);
  }

  function getProjectIdFromRow(row) {
    const link = row.querySelector(".project-title-cell a[href]");
    const url = new URL(link?.getAttribute("href") || "", window.location.href);
    const params = url.searchParams;
    const projectId = clean(params.get("id"));
    const title = clean(params.get("name") || link?.textContent);
    const country = clean(params.get("country") || row.children[2]?.textContent);
    const sector = clean(params.get("sector") || row.children[3]?.textContent);
    const seed = projectId || [title, country, sector].join("|");
    return seed ? `project-${hashSeed(seed)}` : "";
  }

  function getStoredCount(id) {
    try {
      const counts = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return Number(counts[id] || 0);
    } catch (error) {
      return 0;
    }
  }

  function getVisitorId() {
    const key = "icakInterestVisitorId";
    let existing = localStorage.getItem(key);
    if (existing) return existing;
    existing = crypto?.randomUUID ? crypto.randomUUID() : `visitor-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(key, existing);
    return existing;
  }

  function observeLists() {
    ["resultBody", "projectBody"].forEach((id) => {
      const target = document.getElementById(id);
      if (!target || target.dataset.interestSortObserved === "true") return;
      target.dataset.interestSortObserved = "true";
      new MutationObserver(() => refreshInterestData()).observe(target, { childList: true, subtree: true });
    });
  }

  function hashSeed(seed) {
    let hash = 2166136261;
    for (let i = 0; i < seed.length; i += 1) {
      hash ^= seed.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  }

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }
})();
