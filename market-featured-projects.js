(() => {
  const PROJECT_SHEET_GID = "20260612";
  const PROJECT_RANGE = "A:M";
  const PROJECT_COLUMNS = {
    id: "프로젝트 고유값",
    name: "프로젝트명",
    country: "국가",
    sector: "섹터",
    owner: "발주처",
    cost: "사업비(달러 기준 추정액)",
    stage: "현재 단계",
    latest: "최근 업데이트일",
  };
  const HUNDRED_MILLION_USD = 100_000_000;
  const MILLION_USD = 1_000_000;

  const projectCostMap = new Map();
  let projectDataLoaded = false;

  document.addEventListener("DOMContentLoaded", () => {
    ensureMarketFeaturedSection();
    loadProjectScaleData();
    bindMarketFeaturedObservers();
    renderWhenReady();
  });

  function bindMarketFeaturedObservers() {
    const resultBody = document.getElementById("resultBody");
    if (resultBody) {
      new MutationObserver(renderMarketFeaturedProjects).observe(resultBody, { childList: true });
    }

    ["keywordInput", "startDate", "endDate", "sortSelect", "regionFilter", "countryFilter", "sectorFilter", "infoClassFilter", "highPriorityButton", "resetButton"].forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.addEventListener("click", () => setTimeout(renderMarketFeaturedProjects, 0));
      if (element) element.addEventListener("change", () => setTimeout(renderMarketFeaturedProjects, 0));
      if (element) element.addEventListener("input", () => setTimeout(renderMarketFeaturedProjects, 320));
    });
  }

  function renderWhenReady() {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      renderMarketFeaturedProjects();
      if ((getRows().length && projectDataLoaded) || attempts > 40) clearInterval(timer);
    }, 250);
  }

  async function loadProjectScaleData() {
    try {
      const rows = await fetchProjectSheetData();
      rows.forEach((row) => {
        const project = normalizeProjectRow(row);
        if (!project.name) return;
        if (project.id) projectCostMap.set(`id:${project.id}`, project);
        projectCostMap.set(`name:${project.name}`, project);
      });
    } catch (error) {
      console.warn("Project scale data fetch failed:", error);
    } finally {
      projectDataLoaded = true;
      renderMarketFeaturedProjects();
    }
  }

  async function fetchProjectSheetData() {
    const rangeParam = `&range=${encodeURIComponent(PROJECT_RANGE)}`;
    const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?gid=${PROJECT_SHEET_GID}&headers=1${rangeParam}&tqx=out:json`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const text = await response.text();
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}") + 1;
    const data = JSON.parse(text.substring(jsonStart, jsonEnd));
    const cols = data.table.cols.map((col) => col.label || "");
    return data.table.rows.map((row) => {
      const item = {};
      cols.forEach((col, index) => {
        const cell = row.c[index];
        item[col] = cell ? cell.f || cell.v || "" : "";
      });
      return item;
    });
  }

  function ensureMarketFeaturedSection() {
    if (document.getElementById("marketFeaturedProjects")) return;
    const results = document.querySelector(".market-results-section");
    if (!results) return;

    const section = document.createElement("section");
    section.id = "marketFeaturedProjects";
    section.className = "market-featured-projects";
    section.setAttribute("aria-label", "시장동향 주요 뉴스");
    section.hidden = true;
    results.parentNode.insertBefore(section, results);
  }

  function renderMarketFeaturedProjects() {
    const section = document.getElementById("marketFeaturedProjects");
    if (!section) return;

    const rows = getRows();
    const featured = selectFeaturedNews(rows);
    section.hidden = featured.length === 0;
    if (!featured.length) {
      section.innerHTML = "";
      return;
    }

    const projectLinkedCount = featured.filter((item) => item.linkedProject?.costKnown).length;
    const helperText = projectLinkedCount
      ? "현재 시장동향 결과 중 사업비가 확인된 프로젝트 연결 기사를 우선 노출하고, 부족할 경우 중요도·최신성 기준으로 보완합니다."
      : "현재 시장동향 결과에서 중요도·담당자 활용 체크·최신성 기준으로 주요 뉴스를 노출합니다.";

    section.innerHTML = `
      <div class="market-featured-head">
        <div>
          <span>Market News Cards</span>
          <h2>시장동향 주요 뉴스 3건</h2>
        </div>
        <p>${escapeHtml(helperText)}</p>
      </div>
      <div class="market-featured-grid">
        ${featured.map(renderMarketFeaturedCard).join("")}
      </div>
    `;
  }

  function selectFeaturedNews(rows) {
    const candidates = rows.map((row) => ({ row, linkedProject: findLinkedProject(row) }));
    const projectLinked = candidates
      .filter((item) => item.linkedProject?.costKnown)
      .sort((a, b) => b.linkedProject.costValue - a.linkedProject.costValue || getRowTime(b.row) - getRowTime(a.row));

    const fallback = candidates
      .filter((item) => !projectLinked.some((selected) => selected.row.id === item.row.id))
      .sort(compareNewsPriority);

    const merged = [...projectLinked, ...fallback];
    const seen = new Set();
    const selected = [];
    for (const item of merged) {
      const key = item.linkedProject?.id || item.row["기사 고유값"] || item.row.id;
      if (seen.has(key)) continue;
      seen.add(key);
      selected.push(item);
      if (selected.length >= 3) break;
    }
    return selected;
  }

  function compareNewsPriority(a, b) {
    return getPriorityScore(b) - getPriorityScore(a) || getRowTime(b.row) - getRowTime(a.row);
  }

  function getPriorityScore(item) {
    let score = 0;
    const row = item.row;
    if (clean(row["중요도"]) === "상") score += 1000;
    if (clean(row["담당자 활용시 체크"])) score += 400;
    if (item.linkedProject?.costKnown) score += 300;
    if (clean(row["정보 분류"]) === "프로젝트 정보") score += 120;
    if (clean(row["프로젝트명"])) score += 80;
    if (clean(row["출처링크"])) score += 20;
    return score;
  }

  function getRowTime(row) {
    return row._publishedDate?.getTime?.() || row._collectedDate?.getTime?.() || 0;
  }

  function findLinkedProject(row) {
    const projectId = clean(row["프로젝트 고유값"]);
    const projectName = clean(row["프로젝트명"]);
    return (projectId && projectCostMap.get(`id:${projectId}`)) || (projectName && projectCostMap.get(`name:${projectName}`)) || null;
  }

  function renderMarketFeaturedCard(item, index) {
    const row = item.row;
    const project = item.linkedProject;
    const title = row["제목(한글)"] || row["제목(원문)"] || project?.name || "제목 미확인";
    const url = project ? buildProjectUrl(project) : row["출처링크"] || "#";
    const costText = project?.costKnown ? formatCostText(project.costValue) : "주요 뉴스";
    const meta = [row["국가"], row["섹터"], row["정보 분류"]].filter(Boolean).join(" · ") || "시장동향";
    const topic = row["주제"] || project?.stage || "키워드 미확인";
    const dateText = typeof formatDate === "function" ? formatDate(row._publishedDate) : "";

    return `
      <article class="market-featured-card">
        <a href="${escapeAttribute(url)}" ${url === "#" ? "" : 'target="_blank" rel="noreferrer"'} aria-label="${escapeAttribute(title)} 열기">
          <span class="market-featured-rank">Top ${index + 1}</span>
          <strong>${escapeHtml(project?.name || title)}</strong>
          <span class="market-featured-cost">${escapeHtml(costText)}</span>
          <span class="market-featured-meta">${escapeHtml(meta)}${dateText ? ` · ${escapeHtml(dateText)}` : ""}</span>
          <span class="market-featured-topic">${escapeHtml(topic)}</span>
          <small>${escapeHtml(title)}</small>
        </a>
      </article>
    `;
  }

  function normalizeProjectRow(row) {
    const costText = clean(row[PROJECT_COLUMNS.cost]);
    const costValue = parseCostValue(costText);
    return {
      id: clean(row[PROJECT_COLUMNS.id]),
      name: clean(row[PROJECT_COLUMNS.name]),
      country: clean(row[PROJECT_COLUMNS.country]),
      sector: clean(row[PROJECT_COLUMNS.sector]),
      owner: clean(row[PROJECT_COLUMNS.owner]),
      stage: clean(row[PROJECT_COLUMNS.stage]) || "-",
      costValue,
      costKnown: costValue > 0 && !isUnknownCost(costText),
    };
  }

  function buildProjectUrl(project) {
    const params = new URLSearchParams();
    if (project.id) params.set("id", project.id);
    params.set("name", project.name);
    if (project.country) params.set("country", project.country);
    if (project.sector) params.set("sector", project.sector);
    return `./project.html?${params.toString()}`;
  }

  function getRows() {
    try {
      if (Array.isArray(state?.filteredRows)) return state.filteredRows;
    } catch (error) {
      return [];
    }
    return [];
  }

  function parseCostValue(value) {
    if (isUnknownCost(value)) return 0;
    const text = String(value).toLowerCase().replace(/,/g, "");
    const firstNumber = Number((text.match(/[0-9]+(?:\.[0-9]+)?/) || [0])[0]);
    if (!firstNumber) return 0;
    if (text.includes("billion") || text.includes("bn")) return firstNumber * 1_000_000_000;
    if (text.includes("million") || text.includes("mn") || text.includes("백만")) return firstNumber * 1_000_000;
    if (text.includes("억") && text.includes("달러")) return firstNumber * 100_000_000;
    if (text.includes("만") && text.includes("달러")) return firstNumber * 10_000;
    return firstNumber;
  }

  function isUnknownCost(value) {
    const text = String(value || "").trim();
    return !text || text === "사업비 미확인" || text === "미공개";
  }

  function formatCostText(value) {
    if (value >= HUNDRED_MILLION_USD) return `${formatCompact(value / HUNDRED_MILLION_USD)}억불`;
    return `${formatCompact(value / MILLION_USD)}백만불`;
  }

  function formatCompact(value) {
    const rounded = Math.round(value * 10) / 10;
    return new Intl.NumberFormat("ko-KR").format(Number.isInteger(rounded) ? rounded : rounded);
  }

  function clean(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replaceAll("`", "&#096;");
  }
})();