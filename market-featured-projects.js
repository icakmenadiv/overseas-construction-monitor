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
        if (!project.name || !project.costKnown) return;
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
    section.setAttribute("aria-label", "시장 모니터링 대표 프로젝트");
    section.hidden = true;
    results.parentNode.insertBefore(section, results);
  }

  function renderMarketFeaturedProjects() {
    const section = document.getElementById("marketFeaturedProjects");
    if (!section) return;

    const rows = getRows();
    const featured = selectFeaturedProjects(rows);
    section.hidden = featured.length === 0;
    if (!featured.length) {
      section.innerHTML = "";
      return;
    }

    section.innerHTML = `
      <div class="market-featured-head">
        <div>
          <span>Featured Project Cards</span>
          <h2>대표 프로젝트 3건</h2>
        </div>
        <p>현재 시장 모니터링 결과 중 프로젝트 시트와 연결되고 사업비가 확인된 건을 규모순으로 노출합니다. 목록에는 동일 기사가 중복 표시됩니다.</p>
      </div>
      <div class="market-featured-grid">
        ${featured.map(renderMarketFeaturedCard).join("")}
      </div>
    `;
  }

  function selectFeaturedProjects(rows) {
    const projectMap = new Map();
    rows.forEach((row) => {
      const linked = findLinkedProject(row);
      if (!linked) return;
      const key = linked.id || linked.name;
      const existing = projectMap.get(key);
      const articleDate = row._publishedDate?.getTime() || 0;
      if (!existing || linked.costValue > existing.costValue || articleDate > existing.articleDate) {
        projectMap.set(key, {
          ...linked,
          articleTitle: row["제목(한글)"] || row["제목(원문)"] || linked.name,
          articleTopic: row["주제"] || "키워드 미확인",
          infoClass: row["정보 분류"] || "프로젝트 정보",
          articleDate,
        });
      }
    });

    return [...projectMap.values()].sort((a, b) => b.costValue - a.costValue || b.articleDate - a.articleDate).slice(0, 3);
  }

  function findLinkedProject(row) {
    const projectId = row["프로젝트 고유값"];
    const projectName = row["프로젝트명"];
    return (projectId && projectCostMap.get(`id:${projectId}`)) || (projectName && projectCostMap.get(`name:${projectName}`)) || null;
  }

  function renderMarketFeaturedCard(project, index) {
    const url = buildProjectUrl(project);
    return `
      <article class="market-featured-card">
        <a href="${escapeAttribute(url)}" aria-label="${escapeAttribute(project.name)} 프로젝트 상세 열기">
          <span class="market-featured-rank">Top ${index + 1}</span>
          <strong>${escapeHtml(project.name)}</strong>
          <span class="market-featured-cost">${escapeHtml(formatCostText(project.costValue))}</span>
          <span class="market-featured-meta">${escapeHtml(project.country || "-")} · ${escapeHtml(project.sector || "-")} · ${escapeHtml(project.stage || "-")}</span>
          <span class="market-featured-topic">${escapeHtml(project.articleTopic)}</span>
          <small>${escapeHtml(project.articleTitle)}</small>
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