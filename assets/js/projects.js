/* =========================================================
   source: projects.js
   ========================================================= */

const CONFIG = {
  PROJECT_DATA_URL: "./data/projects.json",
  ARTICLE_DATA_URL: "./data/articles.json",
  META_URL: "./data/meta.json",
  SHEET_ID: "11WmfuDj7FSk5LRvEB2CArVETZOA9NgpySLYscG223-E",
  RESULT_GID: "748239675",
  PROJECT_GID: "20260612",
  RESULT_RANGE: "A1:S50000",
  PROJECT_RANGE: "A1:M20000",
  SMALL_COST_THRESHOLD_USD: 10_000_000,
  HUNDRED_MILLION_USD: 100_000_000,
  MILLION_USD: 1_000_000,
};

const PROJECT_COLUMNS = [
  "프로젝트 고유값",
  "프로젝트명",
  "지역",
  "국가",
  "섹터",
  "발주처",
  "사업비(달러 기준 추정액)",
  "사업비 환산 환율 / 기준",
  "현재 단계",
  "최근 업데이트일",
  "대표 기사 고유값",
  "비고",
  "대표 기사 정보 분류",
];

const INTEREST_COUNT_COLUMNS = ["관심도", "관심도 집계", "관심수", "하트수", "관심도 수치"];

const STAGE_ORDER = [
  "study",
  "planning",
  "pre-procurement",
  "tender",
  "bid-evaluation",
  "awarded",
  "contracted",
  "financing",
  "construction",
  "completion",
  "operation",
  "on-hold",
  "cancelled",
  "concept",
  "pre-feasibility",
  "feasibility study",
  "feasibility",
  "design",
  "pre-qualification",
  "prequalification",
  "bidding",
  "bid evaluation",
  "contract award",
  "contract awarded",
  "contract signing",
  "financial close",
  "pre-construction",
  "on hold",
];

const state = {
  projects: [],
  filteredProjects: [],
  cacheMeta: null,
};

window.projectState = state;

const els = {
  syncStatus: document.getElementById("syncStatus"),
  keywordInput: document.getElementById("keywordInput"),
  regionFilter: document.getElementById("regionFilter"),
  countryFilter: document.getElementById("countryFilter"),
  sectorFilter: document.getElementById("sectorFilter"),
  stageFilter: document.getElementById("stageFilter"),
  sortSelect: document.getElementById("sortSelect"),
  includeSmallCost: document.getElementById("includeSmallCost"),
  includeUnknownCost: document.getElementById("includeUnknownCost"),
  resetButton: document.getElementById("resetButton"),
  refreshButton: document.getElementById("refreshButton"),
  backToTopButton: document.getElementById("backToTopButton"),
  activeFilterText: document.getElementById("activeFilterText"),
  totalCount: document.getElementById("totalCount"),
  filteredCount: document.getElementById("filteredCount"),
  countryCount: document.getElementById("countryCount"),
  sectorCount: document.getElementById("sectorCount"),
  latestDate: document.getElementById("latestDate"),
  resultCountLabel: document.getElementById("resultCountLabel"),
  loadingState: document.getElementById("loadingState"),
  errorState: document.getElementById("errorState"),
  emptyState: document.getElementById("emptyState"),
  tableWrap: document.getElementById("tableWrap"),
  projectBody: document.getElementById("projectBody"),
  featuredProjects: document.getElementById("featuredProjects"),
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  setupUnifiedHeader();
  updateProjectHelpText();
  bindEvents();
  await loadProjects();
}

function setupUnifiedHeader() {
  const eyebrow = document.querySelector(".brand-wrap .eyebrow");
  const title = document.querySelector(".brand-wrap h1");
  const subtitle = document.querySelector(".brand-wrap .subtitle");
  if (eyebrow) eyebrow.textContent = "Project Pipeline Tracker";
  if (title) title.textContent = "글로벌 프로젝트 모니터링";
  if (subtitle) subtitle.textContent = "사업 단계와 최신 업데이트를 연결해 유망 사업을 지속적으로 추적합니다.";
}

function updateProjectHelpText() {
  const helpText = document.querySelector(".results-section .section-head p");
  if (helpText) helpText.textContent = "프로젝트 행을 누르면 관련 기사 상세 목록을 확인할 수 있습니다.";
}

function bindEvents() {
  const debouncedApplyFilters = debounce(applyFilters, 300);
  if (els.keywordInput) els.keywordInput.addEventListener("input", debouncedApplyFilters);
  if (els.sortSelect) els.sortSelect.addEventListener("input", debouncedApplyFilters);
  if (els.includeSmallCost) els.includeSmallCost.addEventListener("change", applyFilters);
  if (els.includeUnknownCost) els.includeUnknownCost.addEventListener("change", applyFilters);

  [els.countryFilter, els.sectorFilter, els.stageFilter].forEach((element) => {
    if (element) element.addEventListener("change", debouncedApplyFilters);
  });

  if (els.regionFilter) {
    els.regionFilter.addEventListener("change", () => {
      updateCountryOptions();
      applyFilters();
    });
  }

  if (els.resetButton) {
    els.resetButton.addEventListener("click", () => {
      if (els.keywordInput) els.keywordInput.value = "";
      clearCheckedValues(els.regionFilter);
      clearCheckedValues(els.countryFilter);
      clearCheckedValues(els.sectorFilter);
      clearCheckedValues(els.stageFilter);
      if (els.includeSmallCost) els.includeSmallCost.checked = true;
      if (els.includeUnknownCost) els.includeUnknownCost.checked = true;
      if (els.sortSelect) els.sortSelect.value = "cost:desc";
      updateCountryOptions();
      applyFilters();
    });
  }

  if (els.refreshButton) els.refreshButton.addEventListener("click", () => loadProjects({ bustCache: true }));
  if (els.backToTopButton) {
    els.backToTopButton.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }
}

function debounce(fn, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

async function loadProjects({ bustCache = false } = {}) {
  try {
    if (els.refreshButton) els.refreshButton.disabled = true;
    if (els.syncStatus) els.syncStatus.textContent = "캐시 데이터 새로 고침 중...";

    const [projectRows, articles, meta] = await Promise.all([
      fetchRowsWithSheetFallback(CONFIG.PROJECT_DATA_URL, CONFIG.PROJECT_GID, CONFIG.PROJECT_RANGE, bustCache),
      fetchRowsWithSheetFallback(CONFIG.ARTICLE_DATA_URL, CONFIG.RESULT_GID, CONFIG.RESULT_RANGE, bustCache).catch(() => []),
      fetchJson(CONFIG.META_URL, bustCache).catch(() => null),
    ]);
    const projects = Array.isArray(projectRows) ? projectRows : projectRows?.projects || [];
    const articleRows = Array.isArray(articles) ? articles : articles?.articles || [];
    const representativeMeta = buildRepresentativeMeta(articleRows);

    state.cacheMeta = meta;
    state.projects = normalizeRows(projects, PROJECT_COLUMNS)
      .map((row) => normalizeProject(row, representativeMeta))
      .filter((project) => project.name && project.latestDateText);

    populateFilters();
    applyFilters();
    updateSyncStatus();
  } catch (error) {
    console.error("Project monitoring fetch error:", error);
    showError();
  } finally {
    if (els.refreshButton) els.refreshButton.disabled = false;
  }
}

async function fetchJson(path, bustCache = false) {
  const url = bustCache ? `${path}?t=${Date.now()}` : path;
  const response = await fetch(url, { cache: bustCache ? "reload" : "no-cache" });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return response.json();
}

async function fetchRowsWithSheetFallback(path, gid, range, bustCache = false) {
  try {
    const payload = await fetchJson(path, bustCache);
    const rows = Array.isArray(payload) ? payload : payload?.rows || payload?.articles || payload?.projects || [];
    if (rows.length) return rows;
    throw new Error(`Static cache is empty: ${path}`);
  } catch (error) {
    console.warn("Static cache unavailable; reading source sheet once.", error);
    if (els.syncStatus) els.syncStatus.textContent = "캐시 비어 있음 - 시트 원본 확인 중...";
    return fetchSheetRows(gid, range);
  }
}

async function fetchSheetRows(gid, range) {
  const url = new URL(`https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq`);
  url.searchParams.set("gid", gid);
  url.searchParams.set("headers", "1");
  url.searchParams.set("range", range);
  url.searchParams.set("tqx", "out:json");

  const response = await fetch(url.toString(), { cache: "no-cache" });
  if (!response.ok) throw new Error(`Google Sheets request failed: ${response.status}`);
  const text = await response.text();
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}") + 1;
  if (jsonStart === -1 || jsonEnd === 0) throw new Error("Invalid Google Sheets response");

  const data = JSON.parse(text.slice(jsonStart, jsonEnd));
  const columns = (data.table?.cols || []).map((column) => cleanValue(column.label));
  return (data.table?.rows || []).map((row) => {
    const item = {};
    columns.forEach((column, index) => {
      if (!column) return;
      const cell = row.c?.[index];
      item[column] = cleanValue(cell ? cell.f ?? cell.v ?? "" : "");
    });
    return item;
  });
}

function updateSyncStatus() {
  if (!els.syncStatus) return;
  const updatedAt = state.cacheMeta?.updatedAt;
  els.syncStatus.textContent = updatedAt ? `캐시 기준 ${formatDateTime(new Date(updatedAt))}` : `캐시 기준 ${formatDateTime(new Date())}`;
}

function buildRepresentativeMeta(rows) {
  return rows.reduce((map, row) => {
    const articleId = cleanValue(row["기사 고유값"]);
    if (!articleId) return map;
    map.set(articleId, {
      topic: cleanValue(row["주제"]),
      interestCount: getSheetInterestCount(row),
    });
    return map;
  }, new Map());
}

function normalizeRows(rows, columns) {
  return rows
    .map((row, index) => {
      const normalized = { id: row["프로젝트 고유값"] || String(index) };
      columns.forEach((column) => {
        normalized[column] = cleanValue(row[column]);
      });
      return normalized;
    })
    .filter((row) => columns.some((column) => row[column]));
}

function normalizeProject(row, representativeMeta = new Map()) {
  const costText = row["사업비(달러 기준 추정액)"] || "사업비 미확인";
  const costValue = parseCostValue(costText);
  const latestDate = parseSheetDate(row["최근 업데이트일"]);
  const latestDateText = formatDate(latestDate) || row["최근 업데이트일"];
  const representativeArticleId = row["대표 기사 고유값"];
  const articleMeta = representativeMeta.get(representativeArticleId) || {};

  return {
    projectId: row["프로젝트 고유값"],
    name: row["프로젝트명"],
    region: row["지역"],
    country: row["국가"],
    sector: row["섹터"],
    owner: row["발주처"],
    costText,
    costValue,
    costKnown: costValue > 0 && !isUnknownCost(costText),
    exchangeBasis: row["사업비 환산 환율 / 기준"],
    stage: row["현재 단계"] || "-",
    latestDate,
    latestDateText,
    representativeArticleId,
    representativeTopic: articleMeta.topic || "",
    representativeInterestCount: articleMeta.interestCount || 0,
    representativeInfoClass: row["대표 기사 정보 분류"] || "프로젝트 정보",
    note: row["비고"],
  };
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

function isSmallCost(project) {
  return project.costKnown && project.costValue <= CONFIG.SMALL_COST_THRESHOLD_USD;
}

function populateFilters() {
  setCheckboxOptions(els.regionFilter, uniqueValues(state.projects, "region"), getCheckedValues(els.regionFilter));
  setCheckboxOptions(els.sectorFilter, uniqueValues(state.projects, "sector"), getCheckedValues(els.sectorFilter));
  setCheckboxOptions(
    els.stageFilter,
    sortStageValues(uniqueValues(state.projects, "stage").filter((value) => value !== "-")),
    getCheckedValues(els.stageFilter),
  );
  updateCountryOptions();
}

function updateCountryOptions() {
  const selectedRegions = getCheckedValues(els.regionFilter);
  const source = selectedRegions.length ? state.projects.filter((project) => selectedRegions.includes(project.region)) : state.projects;
  setCheckboxOptions(els.countryFilter, uniqueValues(source, "country"), getCheckedValues(els.countryFilter));
}

function applyFilters() {
  const keyword = (els.keywordInput?.value || "").trim().toLowerCase();
  const regions = getCheckedValues(els.regionFilter);
  const countries = getCheckedValues(els.countryFilter);
  const sectors = getCheckedValues(els.sectorFilter);
  const stages = getCheckedValues(els.stageFilter);
  const excludeSmallCost = Boolean(els.includeSmallCost?.checked);
  const excludeUnknownCost = Boolean(els.includeUnknownCost?.checked);

  let projects = state.projects.filter((project) => {
    const keywordOk =
      !keyword ||
      [
        project.projectId,
        project.name,
        project.owner,
        project.representativeArticleId,
        project.representativeTopic,
        project.note,
        project.region,
        project.country,
        project.sector,
        project.stage,
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    const regionOk = !regions.length || regions.includes(project.region);
    const countryOk = !countries.length || countries.includes(project.country);
    const sectorOk = !sectors.length || sectors.includes(project.sector);
    const stageOk = !stages.length || stages.includes(project.stage);
    const unknownCostOk = !excludeUnknownCost || project.costKnown;
    const smallCostOk = !excludeSmallCost || !isSmallCost(project);
    return keywordOk && regionOk && countryOk && sectorOk && stageOk && unknownCostOk && smallCostOk;
  });

  projects = sortProjects(projects, els.sortSelect?.value || "cost:desc");
  state.filteredProjects = projects;
  updateSummary();
  renderFeaturedProjects();
  renderProjects();
  updateActiveFilterText();
}

window.applyProjectFilters = applyFilters;

function sortProjects(projects, sortValue) {
  const [key, direction] = sortValue.split(":");
  const multiplier = direction === "desc" ? -1 : 1;
  return [...projects].sort((a, b) => {
    if (key === "cost") return (a.costValue - b.costValue) * multiplier;
    if (key === "interest") return (a.representativeInterestCount - b.representativeInterestCount) * multiplier;
    if (key === "latest") return ((a.latestDate?.getTime() || 0) - (b.latestDate?.getTime() || 0)) * multiplier;
    if (key === "country") return a.country.localeCompare(b.country, "ko") * multiplier;
    return a.name.localeCompare(b.name, "ko") * multiplier;
  });
}

function renderFeaturedProjects() {
  if (!els.featuredProjects) return;
  const featured = [...state.filteredProjects].filter((project) => project.costKnown).sort((a, b) => b.costValue - a.costValue).slice(0, 3);
  els.featuredProjects.hidden = featured.length === 0;
  if (!featured.length) {
    els.featuredProjects.innerHTML = "";
    return;
  }
  els.featuredProjects.innerHTML = `
    <div class="featured-projects-head">
      <div>
        <span>대표 프로젝트</span>
        <h2>사업비 규모 기준 상위 3건</h2>
      </div>
      <p>현재 필터 결과에서 사업비가 확인된 프로젝트만 기준으로 표시합니다.</p>
    </div>
    <div class="featured-project-card-grid">${featured.map(renderFeaturedProjectCard).join("")}</div>`;
}

function renderFeaturedProjectCard(project, index) {
  const url = buildProjectUrl(project);
  return `
    <article class="featured-project-card">
      <a href="${escapeAttribute(url)}" aria-label="${escapeAttribute(project.name)} 프로젝트 상세페이지 열기">
        <span class="featured-rank">Top ${index + 1}</span>
        <strong>${escapeHtml(project.name)}</strong>
        <span class="featured-cost">${escapeHtml(formatCost(project))}</span>
        <span class="featured-meta">${escapeHtml(project.country || "-")} · ${escapeHtml(project.sector || "-")} · ${escapeHtml(project.stage || "-")}</span>
        <span class="featured-keyword">${escapeHtml(project.representativeTopic || "키워드 미확인")}</span>
      </a>
    </article>`;
}

function renderProjects() {
  els.loadingState.hidden = true;
  els.errorState.hidden = true;
  els.emptyState.hidden = state.filteredProjects.length > 0;
  els.tableWrap.hidden = state.filteredProjects.length === 0;
  els.projectBody.innerHTML = "";
  const fragment = document.createDocumentFragment();
  state.filteredProjects.forEach((project) => {
    const url = buildProjectUrl(project);
    const tr = document.createElement("tr");
    tr.className = "project-row-link";
    tr.tabIndex = 0;
    tr.setAttribute("role", "link");
    tr.setAttribute("aria-label", `${project.name} 프로젝트 상세페이지 열기`);
    tr.innerHTML = `
      <td class="project-title-cell"><a class="title-link" href="${escapeAttribute(url)}">${escapeHtml(project.name)}</a></td>
      <td><span class="pill">${escapeHtml(project.region || "-")}</span></td>
      <td>${escapeHtml(project.country || "-")}</td>
      <td>${escapeHtml(project.sector || "-")}</td>
      <td><span class="keyword-pill">${escapeHtml(project.representativeTopic || "-")}</span></td>
      <td>${escapeHtml(project.owner || "-")}</td>
      <td>${escapeHtml(formatCost(project))}</td>
      <td><span class="pill stage-pill">${escapeHtml(project.stage || "-")}</span></td>
      <td class="date-cell">${escapeHtml(project.latestDateText)}</td>`;
    tr.addEventListener("click", (event) => {
      if (event.target.closest("a")) return;
      window.location.href = url;
    });
    tr.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        window.location.href = url;
      }
    });
    fragment.appendChild(tr);
  });
  els.projectBody.appendChild(fragment);
}

function buildProjectUrl(project) {
  const params = new URLSearchParams();

  params.set("name", project.name);
  if (project.country) params.set("country", project.country);
  if (project.sector) params.set("sector", project.sector);
  return `./project.html?${params.toString()}`;
}

function updateSummary() {
  const latest = state.projects.map((project) => project.latestDate).filter(Boolean).sort((a, b) => b.getTime() - a.getTime())[0];
  els.totalCount.textContent = numberFormat(state.projects.length);
  els.filteredCount.textContent = numberFormat(state.filteredProjects.length);
  els.countryCount.textContent = numberFormat(uniqueValues(state.projects, "country").length);
  els.sectorCount.textContent = numberFormat(uniqueValues(state.projects, "sector").length);
  els.latestDate.textContent = latest ? formatDate(latest) : "-";
  els.resultCountLabel.textContent = `${numberFormat(state.filteredProjects.length)}건`;
}

function updateActiveFilterText() {
  const filters = [];
  if (els.keywordInput?.value?.trim()) filters.push(`검색: ${els.keywordInput.value.trim()}`);
  pushSelectedFilter(filters, "지역", getCheckedValues(els.regionFilter));
  pushSelectedFilter(filters, "국가", getCheckedValues(els.countryFilter));
  pushSelectedFilter(filters, "섹터", getCheckedValues(els.sectorFilter));
  pushSelectedFilter(filters, "단계", getCheckedValues(els.stageFilter));
  filters.push(els.includeSmallCost?.checked ? "1천만불 이하 제외" : "1천만불 이하 포함");
  filters.push(els.includeUnknownCost?.checked ? "사업비 미포함 제외" : "사업비 미포함 포함");
  els.activeFilterText.textContent = filters.join(" · ");
}

function pushSelectedFilter(filters, label, values) {
  if (!values.length) return;
  const suffix = values.length > 1 ? ` 외 ${values.length - 1}` : "";
  filters.push(`${label}: ${values[0]}${suffix}`);
}

function setCheckboxOptions(container, values, selectedValues = []) {
  if (!container) return;
  const selected = new Set(selectedValues);
  container.innerHTML = "";
  if (!values.length) {
    const empty = document.createElement("span");
    empty.className = "checkbox-empty";
    empty.textContent = "선택 가능한 항목 없음";
    container.appendChild(empty);
    return;
  }
  values.forEach((value, index) => {
    const label = document.createElement("label");
    label.className = "check-chip";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = value;
    input.checked = selected.has(value);
    input.id = `${container.id}-${index}`;
    const text = document.createElement("span");
    text.textContent = value;
    label.append(input, text);
    container.appendChild(label);
  });
}

function getCheckedValues(container) {
  if (!container) return [];
  return [...container.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value);
}

function clearCheckedValues(container) {
  if (!container) return;
  container.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.checked = false;
  });
}

function uniqueValues(rows, key) {
  return [...new Set(rows.map((row) => row[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
}

function sortStageValues(values) {
  return [...values].sort((a, b) => {
    const rankDiff = getStageRank(a) - getStageRank(b);
    return rankDiff || a.localeCompare(b, "ko");
  });
}

function getStageRank(value) {
  const normalized = normalizeStageName(value);
  const exactIndex = STAGE_ORDER.indexOf(normalized);
  if (exactIndex !== -1) return exactIndex;
  const partialIndex = STAGE_ORDER.findIndex((stage) => normalized.includes(stage) || stage.includes(normalized));
  return partialIndex === -1 ? 999 : partialIndex;
}

function normalizeStageName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/_/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function formatCost(project) {
  if (!project.costKnown) return "사업비 미확인";
  if (project.costValue >= CONFIG.HUNDRED_MILLION_USD) {
    return `${formatCompactAmount(project.costValue / CONFIG.HUNDRED_MILLION_USD)}억불`;
  }
  return `${formatCompactAmount(project.costValue / CONFIG.MILLION_USD)}백만불`;
}

function formatCompactAmount(value) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? numberFormat(rounded) : numberFormat(rounded).replace(/\.0$/, "");
}

function showError() {
  els.loadingState.hidden = true;
  els.errorState.hidden = false;
  els.errorState.textContent = "캐시 데이터를 불러오지 못했습니다. GitHub Actions의 시트 동기화 실행 상태를 확인해주세요.";
  els.emptyState.hidden = true;
  els.tableWrap.hidden = true;
  if (els.featuredProjects) els.featuredProjects.hidden = true;
  if (els.syncStatus) els.syncStatus.textContent = "캐시 데이터 연결 실패";
}

function cleanValue(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function getSheetInterestCount(row) {
  for (const column of INTEREST_COUNT_COLUMNS) {
    const value = Number(String(row?.[column] || "").replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

function parseSheetDate(value) {
  if (!value) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 20000 ? new Date(Math.round((value - 25569) * 86400 * 1000)) : null;
  }
  const text = String(value).trim();
  const dateCtorMatch = text.match(/^Date\((\d+),(\d+),(\d+)/);
  if (dateCtorMatch) return new Date(Number(dateCtorMatch[1]), Number(dateCtorMatch[2]), Number(dateCtorMatch[3]));
  const isoMatch = text.match(/(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})/);
  if (isoMatch) return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(date) {
  if (!date || Number.isNaN(date.getTime())) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateTime(date) {
  if (!date || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function numberFormat(value) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

;

/* =========================================================
   source: project-interest-sort.js
   ========================================================= */

(() => {
  const HEART_COLUMNS = ["관심도", "관심도 집계", "관심수", "하트수", "관심도 수치"];
  const VIEW_COLUMNS = ["조회수", "조회 수", "views", "viewCount"];
  const IMPORTANCE_COLUMNS = ["최종 중요도 수치값", "중요도", "중요도 수치값"];
  const HEART_WEIGHT = 5;

  window.buildRepresentativeMeta = function buildAggregateProjectInterestMeta(rows) {
    const meta = {
      articleById: new Map(),
      projectById: new Map(),
      projectByName: new Map(),
    };

    (rows || []).forEach((row) => {
      const articleId = clean(row?.["기사 고유값"]);
      const projectId = clean(row?.["프로젝트 고유값"]);
      const projectName = clean(row?.["프로젝트명"]);
      const hearts = getFirstPositiveNumber(row, HEART_COLUMNS);
      const views = getFirstPositiveNumber(row, VIEW_COLUMNS);
      const importance = getFirstPositiveNumber(row, IMPORTANCE_COLUMNS);
      const articleScore = hearts * HEART_WEIGHT + views;
      const articleMeta = {
        topic: clean(row?.["주제"]),
        interestCount: hearts,
        heartCount: hearts,
        viewCount: views,
        importanceScore: importance,
        weightedInterestScore: articleScore,
      };

      if (articleId) meta.articleById.set(articleId, articleMeta);
      if (projectId) addProjectAggregate(meta.projectById, projectId, row, articleMeta);
      if (projectName) addProjectAggregate(meta.projectByName, projectName, row, articleMeta);
    });

    meta.get = (articleId) => meta.articleById.get(articleId) || {};
    return meta;
  };

  window.normalizeProject = function normalizeProjectWithAggregateInterest(row, representativeMeta = new Map()) {
    const costText = row["사업비(달러 기준 추정액)"] || "사업비 미확인";
    const costValue = parseCostValueSafe(costText);
    const latestDate = parseSheetDateSafe(row["최근 업데이트일"]);
    const latestDateText = formatDateSafe(latestDate) || row["최근 업데이트일"];
    const representativeArticleId = row["대표 기사 고유값"];
    const projectId = row["프로젝트 고유값"];
    const projectName = row["프로젝트명"];
    const representativeArticleMeta = representativeMeta.get?.(representativeArticleId) || {};
    const projectAggregate =
      representativeMeta.projectById?.get(clean(projectId)) ||
      representativeMeta.projectByName?.get(clean(projectName)) ||
      emptyAggregate();
    const representativeTopic = representativeArticleMeta.topic || projectAggregate.topic || "";

    return {
      projectId,
      name: projectName,
      region: row["지역"],
      country: row["국가"],
      sector: row["섹터"],
      owner: row["발주처"],
      costText,
      costValue,
      costKnown: costValue > 0 && !isUnknownCostSafe(costText),
      exchangeBasis: row["사업비 환산 환율 / 기준"],
      stage: row["현재 단계"] || "-",
      latestDate,
      latestDateText,
      representativeArticleId,
      representativeTopic,
      representativeInterestCount: projectAggregate.weightedInterestScore || representativeArticleMeta.weightedInterestScore || 0,
      aggregateHeartCount: projectAggregate.heartCount || 0,
      aggregateViewCount: projectAggregate.viewCount || 0,
      aggregateImportanceScore: projectAggregate.maxImportanceScore || representativeArticleMeta.importanceScore || 0,
      relatedArticleCount: projectAggregate.articleCount || 0,
      representativeInfoClass: row["대표 기사 정보 분류"] || "프로젝트 정보",
      note: row["비고"],
    };
  };

  window.sortProjects = function sortProjectsWithAggregateInterest(projects, sortValue) {
    const [key, direction] = String(sortValue || "cost:desc").split(":");
    const multiplier = direction === "desc" ? -1 : 1;
    return [...projects].sort((a, b) => {
      if (key === "cost") return compareNumber(a.costValue, b.costValue, multiplier);
      if (key === "interest") {
        return (
          compareNumber(a.representativeInterestCount, b.representativeInterestCount, multiplier) ||
          compareNumber(a.aggregateHeartCount, b.aggregateHeartCount, multiplier) ||
          compareNumber(a.aggregateViewCount, b.aggregateViewCount, multiplier) ||
          compareNumber(a.aggregateImportanceScore, b.aggregateImportanceScore, multiplier) ||
          compareDateDesc(a.latestDate, b.latestDate) ||
          compareNumber(a.costValue, b.costValue, -1) ||
          compareText(a.name, b.name)
        );
      }
      if (key === "latest") return compareDate(a.latestDate, b.latestDate, multiplier);
      if (key === "country") return compareText(a.country, b.country) * multiplier;
      return compareText(a.name, b.name) * multiplier;
    });
  };

  function addProjectAggregate(map, key, row, articleMeta) {
    const normalizedKey = clean(key);
    if (!normalizedKey) return;
    const current = map.get(normalizedKey) || emptyAggregate();
    current.heartCount += articleMeta.heartCount || 0;
    current.viewCount += articleMeta.viewCount || 0;
    current.weightedInterestScore = current.heartCount * HEART_WEIGHT + current.viewCount;
    current.maxImportanceScore = Math.max(current.maxImportanceScore || 0, articleMeta.importanceScore || 0);
    current.articleCount += 1;
    if (!current.topic && row?.["주제"]) current.topic = clean(row["주제"]);
    map.set(normalizedKey, current);
  }

  function emptyAggregate() {
    return {
      heartCount: 0,
      viewCount: 0,
      weightedInterestScore: 0,
      maxImportanceScore: 0,
      articleCount: 0,
      topic: "",
    };
  }

  function compareNumber(a, b, multiplier) {
    return (Number(a || 0) - Number(b || 0)) * multiplier;
  }

  function compareDate(a, b, multiplier) {
    return ((a?.getTime?.() || 0) - (b?.getTime?.() || 0)) * multiplier;
  }

  function compareDateDesc(a, b) {
    return (b?.getTime?.() || 0) - (a?.getTime?.() || 0);
  }

  function compareText(a, b) {
    return clean(a).localeCompare(clean(b), "ko");
  }

  function getFirstPositiveNumber(row, columns) {
    for (const column of columns) {
      const value = parseNumber(row?.[column]);
      if (value > 0) return value;
    }
    return 0;
  }

  function parseNumber(value) {
    const match = clean(value).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : 0;
  }

  function parseCostValueSafe(value) {
    if (isUnknownCostSafe(value)) return 0;
    const text = clean(value)
      .toLowerCase()
      .replace(/,/g, "")
      .replace(/\([^)]*\)/g, " ");
    const candidates = [];
    collectCostCandidates(text, /([0-9]+(?:\.[0-9]+)?)\s*(?:billion|bn)\b/g, 1_000_000_000, candidates);
    collectCostCandidates(text, /([0-9]+(?:\.[0-9]+)?)\s*(?:million|mn|m)\b/g, 1_000_000, candidates);
    collectCostCandidates(text, /([0-9]+(?:\.[0-9]+)?)\s*백만\s*(?:달러|불|usd)?/g, 1_000_000, candidates);
    collectCostCandidates(text, /([0-9]+(?:\.[0-9]+)?)\s*억\s*(?:달러|불|usd)?/g, 100_000_000, candidates);
    collectCostCandidates(text, /([0-9]+(?:\.[0-9]+)?)\s*만\s*(?:달러|불|usd)/g, 10_000, candidates);
    if (candidates.length) return Math.max(...candidates);

    const literalDollarMatch =
      text.match(/(?:usd|us\$|달러|불)\s*([0-9]+(?:\.[0-9]+)?)/) ||
      text.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:usd|us\$|달러|불)/);
    return literalDollarMatch ? Number(literalDollarMatch[1]) : 0;
  }

  function collectCostCandidates(text, regex, multiplier, candidates) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      const amount = Number(match[1]);
      if (Number.isFinite(amount) && amount > 0) candidates.push(amount * multiplier);
    }
  }

  function isUnknownCostSafe(value) {
    const text = clean(value).toLowerCase();
    return !text || /사업비\s*미확인|미공개|환산\s*미공개|unknown|n\/a|tbd|not\s+disclosed/.test(text);
  }

  function parseSheetDateSafe(value) {
    if (typeof window.parseSheetDate === "function") return window.parseSheetDate(value);
    const text = clean(value).replace(/^'+/, "").trim();
    const match = text.match(/(\d{4})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{1,2})/);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function formatDateSafe(date) {
    if (typeof window.formatDate === "function") return window.formatDate(date);
    if (!date || Number.isNaN(date.getTime())) return "";
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function clean(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }
})();

;

/* =========================================================
   source: project-ai-cost.js
   ========================================================= */

(() => {
  const AI_PROJECT_RANGE = "A1:U20000";
  const AI_PROJECT_COLUMNS = [
    "사업비 확인상태",
    "AI추정사업비",
    "AI 추정 신뢰도",
    "AI 추정근거",
    "AI 규모 노출등급",
  ];

  if (typeof CONFIG === "object") CONFIG.PROJECT_RANGE = AI_PROJECT_RANGE;
  if (Array.isArray(PROJECT_COLUMNS)) {
    AI_PROJECT_COLUMNS.forEach((column) => {
      if (!PROJECT_COLUMNS.includes(column)) PROJECT_COLUMNS.push(column);
    });
  }

  try {
    const originalFetchRowsWithSheetFallback = fetchRowsWithSheetFallback;
    fetchRowsWithSheetFallback = async function fetchRowsWithAiCostFallback(path, gid, range, bustCache = false) {
      const rows = await originalFetchRowsWithSheetFallback(path, gid, range, bustCache);
      if (path === CONFIG.PROJECT_DATA_URL && !rowsIncludeAiColumns(rows)) {
        console.warn("Project cache does not include AI cost columns; reading source sheet range A:U.");
        return fetchSheetRows(gid, AI_PROJECT_RANGE);
      }
      return rows;
    };
  } catch (error) {
    console.warn("AI cost data fallback could not be installed.", error);
  }

  const originalSortProjects = typeof sortProjects === "function" ? sortProjects : null;

  function rowsIncludeAiColumns(payload) {
    const rows = Array.isArray(payload) ? payload : payload?.rows || payload?.projects || [];
    if (!rows.length) return false;
    return rows.some((row) => AI_PROJECT_COLUMNS.some((column) => Object.prototype.hasOwnProperty.call(row, column)));
  }

  function normalizeProjectWithAiCost(row, representativeMeta = new Map()) {
    const officialCostText = clean(row["사업비(달러 기준 추정액)"] || "");
    const officialCostValue = parseCostValueForAi(officialCostText);
    const officialCostKnown = officialCostValue > 0 && !isUnknownCostForAi(officialCostText);
    const aiCostText = clean(row["AI추정사업비"] || "");
    const aiCostValue = parseCostValueForAi(aiCostText);
    const hasAiEstimate = !officialCostKnown && aiCostValue > 0;
    const costText = officialCostKnown ? officialCostText : hasAiEstimate ? aiCostText : "사업비 미확인";
    const costValue = officialCostKnown ? officialCostValue : hasAiEstimate ? aiCostValue : 0;
    const latestDate = parseSheetDateSafe(row["최근 업데이트일"]);
    const latestDateText = formatDateSafe(latestDate) || row["최근 업데이트일"];
    const representativeArticleId = row["대표 기사 고유값"] || row["관련 기사 고유값 1"];
    const projectId = row["프로젝트 고유값"];
    const projectName = row["프로젝트명"];
    const representativeArticleMeta = representativeMeta.get?.(representativeArticleId) || {};
    const projectAggregate =
      representativeMeta.projectById?.get(clean(projectId)) ||
      representativeMeta.projectByName?.get(clean(projectName)) ||
      emptyAggregate();
    const representativeTopic = representativeArticleMeta.topic || projectAggregate.topic || "";

    return {
      projectId,
      name: projectName,
      region: row["지역"],
      country: row["국가"],
      sector: row["섹터"],
      owner: row["발주처"],
      costText,
      costValue,
      costKnown: officialCostKnown || hasAiEstimate,
      officialCostText,
      officialCostValue,
      officialCostKnown,
      aiCostText,
      aiCostValue,
      hasAiEstimate,
      aiConfidence: row["AI 추정 신뢰도"],
      aiBasis: row["AI 추정근거"],
      aiExposureClass: row["AI 규모 노출등급"],
      costSource: hasAiEstimate ? "ai" : officialCostKnown ? "official" : "unknown",
      exchangeBasis: row["사업비 환산 환율 / 기준"],
      stage: row["현재 단계"] || "-",
      latestDate,
      latestDateText,
      representativeArticleId,
      representativeTopic,
      representativeInterestCount: projectAggregate.weightedInterestScore || representativeArticleMeta.weightedInterestScore || 0,
      aggregateHeartCount: projectAggregate.heartCount || 0,
      aggregateViewCount: projectAggregate.viewCount || 0,
      aggregateImportanceScore: projectAggregate.maxImportanceScore || representativeArticleMeta.importanceScore || 0,
      relatedArticleCount: projectAggregate.articleCount || 0,
      representativeInfoClass: row["대표 기사 정보 분류"] || "프로젝트 정보",
      note: row["비고"],
    };
  }

  function applyFiltersWithAiCost() {
    const keyword = (els.keywordInput?.value || "").trim().toLowerCase();
    const regions = getCheckedValues(els.regionFilter);
    const countries = getCheckedValues(els.countryFilter);
    const sectors = getCheckedValues(els.sectorFilter);
    const stages = getCheckedValues(els.stageFilter);
    const excludeSmallCost = Boolean(els.includeSmallCost?.checked);

    let projects = state.projects.filter((project) => {
      const keywordOk =
        !keyword ||
        [
          project.projectId,
          project.name,
          project.owner,
          project.representativeArticleId,
          project.representativeTopic,
          project.note,
          project.region,
          project.country,
          project.sector,
          project.stage,
          project.costText,
          project.aiCostText,
          project.aiConfidence,
          project.aiExposureClass,
        ]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      const regionOk = !regions.length || regions.includes(project.region);
      const countryOk = !countries.length || countries.includes(project.country);
      const sectorOk = !sectors.length || sectors.includes(project.sector);
      const stageOk = !stages.length || stages.includes(project.stage);
      const smallCostOk = !excludeSmallCost || !isSmallCostWithAiToggle(project);
      return keywordOk && regionOk && countryOk && sectorOk && stageOk && smallCostOk;
    });

    projects = sortProjects(projects, els.sortSelect?.value || "cost:desc");
    state.filteredProjects = projects;
    updateSummary();
    renderFeaturedProjects();
    renderProjects();
    updateActiveFilterTextWithAiCost();
  }

  function sortProjectsWithAiCost(projects, sortValue) {
    const [key, direction] = String(sortValue || "cost:desc").split(":");
    const multiplier = direction === "desc" ? -1 : 1;
    if (key !== "cost" && originalSortProjects) return originalSortProjects(projects, sortValue);
    return [...projects].sort((a, b) => (getActiveCostValue(a) - getActiveCostValue(b)) * multiplier || clean(a.name).localeCompare(clean(b.name), "ko"));
  }

  function renderFeaturedProjectsWithAiCost() {
    if (!els.featuredProjects) return;
    const featured = [...state.filteredProjects]
      .filter((project) => getActiveCostValue(project) > 0)
      .sort((a, b) => getActiveCostValue(b) - getActiveCostValue(a))
      .slice(0, 3);
    els.featuredProjects.hidden = featured.length === 0;
    if (!featured.length) {
      els.featuredProjects.innerHTML = "";
      return;
    }
    els.featuredProjects.innerHTML = `
      <div class="featured-projects-head">
        <div>
          <span>대표 프로젝트</span>
          <h2>사업비 규모 기준 상위 3건</h2>
        </div>
        <p>현재 필터 결과에서 공식 사업비와 선택 시 AI 추정사업비를 함께 기준으로 표시합니다.</p>
      </div>
      <div class="featured-project-card-grid">${featured.map(renderFeaturedProjectCard).join("")}</div>`;
  }

  function updateActiveFilterTextWithAiCost() {
    const filters = [];
    if (els.keywordInput?.value?.trim()) filters.push(`검색: ${els.keywordInput.value.trim()}`);
    pushSelectedFilter(filters, "지역", getCheckedValues(els.regionFilter));
    pushSelectedFilter(filters, "국가", getCheckedValues(els.countryFilter));
    pushSelectedFilter(filters, "섹터", getCheckedValues(els.sectorFilter));
    pushSelectedFilter(filters, "단계", getCheckedValues(els.stageFilter));
    filters.push(els.includeSmallCost?.checked ? "1천만불 이하 제외" : "1천만불 이하 포함");
    filters.push(isAiEstimateIncluded() ? "AI 추정 사업비 포함" : "공식 사업비만 표시");
    els.activeFilterText.textContent = filters.join(" · ");
  }

  function formatCostWithAiCost(project) {
    const activeValue = getActiveCostValue(project);
    if (!activeValue) return "사업비 미확인";
    const amount =
      activeValue >= CONFIG.HUNDRED_MILLION_USD
        ? `${formatCompactAmount(activeValue / CONFIG.HUNDRED_MILLION_USD)}억불`
        : `${formatCompactAmount(activeValue / CONFIG.MILLION_USD)}백만불`;
    return project.hasAiEstimate && !project.officialCostKnown && isAiEstimateIncluded() ? `${amount} (AI 추정)` : amount;
  }

  function getActiveCostValue(project) {
    if (project.officialCostKnown) return project.officialCostValue || project.costValue || 0;
    if (isAiEstimateIncluded() && project.hasAiEstimate) return project.aiCostValue || project.costValue || 0;
    return 0;
  }

  function isSmallCostWithAiToggle(project) {
    const activeValue = getActiveCostValue(project);
    return activeValue > 0 && activeValue <= CONFIG.SMALL_COST_THRESHOLD_USD;
  }

  function isAiEstimateIncluded() {
    return Boolean(document.getElementById("includeAiEstimate")?.checked ?? true);
  }

  function parseCostValueForAi(value) {
    if (isUnknownCostForAi(value)) return 0;
    const text = clean(value)
      .toLowerCase()
      .replace(/,/g, "")
      .replace(/\([^)]*\)/g, " ");
    const candidates = [];
    collectCostCandidates(text, /([0-9]+(?:\.[0-9]+)?)\s*(?:billion|bn)\b/g, 1_000_000_000, candidates);
    collectCostCandidates(text, /([0-9]+(?:\.[0-9]+)?)\s*(?:million|mn|m)\b/g, 1_000_000, candidates);
    collectCostCandidates(text, /([0-9]+(?:\.[0-9]+)?)\s*백만\s*(?:달러|불|usd)?/g, 1_000_000, candidates);
    collectCostCandidates(text, /([0-9]+(?:\.[0-9]+)?)\s*억\s*(?:달러|불|usd)?/g, 100_000_000, candidates);
    collectCostCandidates(text, /([0-9]+(?:\.[0-9]+)?)\s*만\s*(?:달러|불|usd)/g, 10_000, candidates);
    if (candidates.length) return Math.max(...candidates);

    const literalDollarMatch =
      text.match(/(?:usd|us\$|달러|불)\s*([0-9]+(?:\.[0-9]+)?)/) ||
      text.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:usd|us\$|달러|불)/);
    return literalDollarMatch ? Number(literalDollarMatch[1]) : 0;
  }

  function collectCostCandidates(text, regex, multiplier, candidates) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      const amount = Number(match[1]);
      if (Number.isFinite(amount) && amount > 0) candidates.push(amount * multiplier);
    }
  }

  function isUnknownCostForAi(value) {
    const text = clean(value).toLowerCase();
    return !text || /사업비\s*미확인|미공개|환산\s*미공개|unknown|n\/a|tbd|not\s+disclosed/.test(text);
  }

  function parseSheetDateSafe(value) {
    if (typeof window.parseSheetDate === "function") return window.parseSheetDate(value);
    const text = clean(value).replace(/^'+/, "").trim();
    const match = text.match(/(\d{4})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{1,2})/);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function formatDateSafe(date) {
    if (typeof window.formatDate === "function") return window.formatDate(date);
    if (!date || Number.isNaN(date.getTime())) return "";
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function emptyAggregate() {
    return {
      heartCount: 0,
      viewCount: 0,
      weightedInterestScore: 0,
      maxImportanceScore: 0,
      articleCount: 0,
      topic: "",
    };
  }

  function clean(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  window.normalizeProject = normalizeProjectWithAiCost;
  window.applyProjectFilters = applyFiltersWithAiCost;
  window.renderFeaturedProjects = renderFeaturedProjectsWithAiCost;
  window.formatCost = formatCostWithAiCost;
  window.sortProjects = sortProjectsWithAiCost;

  try {
    normalizeProject = normalizeProjectWithAiCost;
    applyFilters = applyFiltersWithAiCost;
    renderFeaturedProjects = renderFeaturedProjectsWithAiCost;
    formatCost = formatCostWithAiCost;
    sortProjects = sortProjectsWithAiCost;
  } catch (error) {
    console.warn("AI cost override could not rebind every project function.", error);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const aiToggle = document.getElementById("includeAiEstimate");
    if (aiToggle) aiToggle.addEventListener("change", applyFiltersWithAiCost);
    document.querySelectorAll("#resetButton, [data-reset-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        setTimeout(() => {
          if (aiToggle) aiToggle.checked = true;
          applyFiltersWithAiCost();
        }, 0);
      });
    });
  });
})();

;

/* =========================================================
   source: monitor-core-ui.js
   ========================================================= */

(() => {
  const RUN_DELAYS = [0, 120, 360, 900, 1800, 3200];
  let queued = false;
  let initialized = false;
  let expandedTopNewsRowKey = "";

  document.addEventListener("DOMContentLoaded", init);
  if (document.readyState !== "loading") init();

  function init() {
    if (initialized) return;
    initialized = true;
    // Static UI rules are compiled into the page stylesheet.
    patchMenuLabels();
    RUN_DELAYS.forEach((delay) => setTimeout(run, delay));
    document.addEventListener("click", queueRun, true);
    document.addEventListener("change", queueRun, true);
    document.addEventListener("input", queueRun, true);
  }

  function queueRun() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      run();
    });
  }

  function run() {
    patchMenuLabels();
    moveSummaryIntoFilter();
    removeDateSummaryItems();
    moveSortFieldToTop();
    reorderFilterFields();
    setupTopResetButtons();
    setupCollapsibleFilters();
    updateFilterSummaries();
    enhanceTopNewsCards();
    enhanceFeaturedProjectCards();
    markDatePresets();
  }

  function patchMenuLabels() {
    const navLinks = document.querySelectorAll(".page-nav a");
    if (navLinks[0]) navLinks[0].textContent = "해외 건설시장 뉴스";
    if (navLinks[1]) navLinks[1].textContent = "프로젝트 목록";
  }

  function moveSummaryIntoFilter() {
    const panel = document.querySelector(".market-filter-panel") || document.querySelector(".dashboard > .control-panel");
    const summary = document.querySelector(".dashboard > .summary-grid");
    if (!panel || !summary || panel.contains(summary)) return;
    panel.insertBefore(summary, panel.firstElementChild);
  }

  function removeDateSummaryItems() {
    document.querySelectorAll(".control-panel > .summary-grid .summary-item").forEach((item) => {
      const label = clean(item.querySelector("span")?.textContent);
      if (label === "최근 원문게재일" || label === "최근 업데이트") item.remove();
    });
  }

  function moveSortFieldToTop() {
    const sort = document.getElementById("sortSelect");
    const sortField = sort?.closest(".field");
    const topActions = document.querySelector(".control-panel .filter-top-actions");
    if (!sort || !sortField || !topActions || sortField.dataset.sortTopReady === "true") return;
    sortField.classList.add("sort-field-top");
    sortField.dataset.sortTopReady = "true";
    topActions.appendChild(sortField);
  }

  function reorderFilterFields() {
    const grid = document.querySelector(".control-panel .field-grid");
    if (!grid) return;
    ["regionFilter", "countryFilter", "sectorFilter", "stageFilter", "infoClassFilter"].forEach((id) => {
      const field = document.getElementById(id)?.closest(".field");
      if (field && field.parentElement === grid) grid.appendChild(field);
    });
  }

  function setupTopResetButtons() {
    document.querySelectorAll("[data-reset-filter]").forEach((button) => {
      if (button.dataset.coreResetReady === "true") return;
      button.dataset.coreResetReady = "true";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const resetButton = document.getElementById("resetButton");
        if (resetButton) {
          resetButton.click();
          return;
        }
        resetFilterFormFallback();
      });
    });
  }

  function resetFilterFormFallback() {
    const panel = document.querySelector(".control-panel");
    if (!panel) return;
    panel.querySelectorAll('input[type="search"], input[type="text"], input[type="date"]').forEach((input) => {
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    panel.querySelectorAll('.checkbox-filter input[type="checkbox"]').forEach((input) => {
      input.checked = false;
    });
    panel.querySelectorAll(".checkbox-filter").forEach((filter) => {
      filter.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  function setupCollapsibleFilters() {
    document.querySelectorAll(".field-wide").forEach((field) => {
      const currentDetails = field.querySelector(":scope > .filter-collapse");
      if (field.dataset.coreFilterReady === "true" && currentDetails) {
        ensureBulkButton(currentDetails);
        return;
      }

      const label = field.querySelector(":scope > .field-label");
      const filter = field.querySelector(":scope > .checkbox-filter");
      if (!label || !filter) return;

      const details = document.createElement("details");
      details.className = "filter-collapse core-filter-collapse";
      details.open = false;

      const summary = document.createElement("summary");
      summary.className = "filter-summary";
      const title = document.createElement("span");
      title.className = "filter-summary-title";
      title.textContent = clean(label.textContent) || "필터";
      const count = document.createElement("span");
      count.className = "filter-summary-count";
      count.textContent = "전체";
      summary.append(title, count);

      const panel = document.createElement("div");
      panel.className = "filter-options-panel";
      const bulkButton = createBulkButton(filter);

      label.remove();
      field.appendChild(details);
      details.append(summary, panel);
      panel.append(bulkButton, filter);
      field.dataset.coreFilterReady = "true";

      details.addEventListener("toggle", () => {
        if (details.open && details.dataset.openedOnce !== "true") {
          details.dataset.openedOnce = "true";
          clearAllIfEverythingIsChecked(filter);
        }
        updateFilterSummaries();
      });
    });
  }

  function ensureBulkButton(details) {
    const filter = details.querySelector(".checkbox-filter");
    if (!filter) return;
    let panel = details.querySelector(":scope > .filter-options-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.className = "filter-options-panel";
      details.appendChild(panel);
      panel.appendChild(filter);
    }
    if (!panel.querySelector(":scope > .filter-bulk-toggle")) {
      panel.insertBefore(createBulkButton(filter), panel.firstElementChild);
    }
  }

  function createBulkButton(filter) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filter-bulk-toggle";
    button.textContent = "전체 선택/해제";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleFilterSelection(filter);
    });
    return button;
  }

  function toggleFilterSelection(filter) {
    const inputs = [...filter.querySelectorAll('input[type="checkbox"]')];
    if (!inputs.length) return;
    const checkedCount = inputs.filter((input) => input.checked).length;
    const shouldSelectAll = checkedCount === 0;
    inputs.forEach((input) => {
      input.checked = shouldSelectAll;
    });
    filter.dispatchEvent(new Event("change", { bubbles: true }));
    updateFilterSummaries();
  }

  function clearAllIfEverythingIsChecked(filter) {
    const inputs = [...filter.querySelectorAll('input[type="checkbox"]')];
    if (!inputs.length || inputs.some((input) => !input.checked)) return;
    inputs.forEach((input) => {
      input.checked = false;
    });
    filter.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function updateFilterSummaries() {
    document.querySelectorAll(".filter-collapse").forEach((details) => {
      const filter = details.querySelector(".checkbox-filter");
      const count = details.querySelector(".filter-summary-count");
      const bulkButton = details.querySelector(".filter-bulk-toggle");
      if (!filter || !count) return;
      const checked = filter.querySelectorAll('input[type="checkbox"]:checked').length;
      const total = filter.querySelectorAll('input[type="checkbox"]').length;
      count.textContent = checked ? `${formatNumber(checked)}개 선택` : total ? "전체" : "항목 없음";
      if (bulkButton) {
        bulkButton.textContent = checked ? "전체 해제" : "전체 선택";
        bulkButton.disabled = total === 0;
      }
    });
  }

  function enhanceTopNewsCards() {
    const cards = [...document.querySelectorAll("#topNewsCards .top-news-card")];
    const columnCount = getTopNewsColumnCount();
    cards.forEach((card, index) => {
      const row = findArticleForCard(card);
      const rowKey = `row-${Math.floor(index / columnCount)}`;
      card.dataset.topNewsRowKey = rowKey;
      card.dataset.articleId = row?.id || normalize(card.querySelector("h3")?.textContent);
      card.setAttribute("role", "button");
      card.tabIndex = 0;
      card.setAttribute("aria-expanded", String(expandedTopNewsRowKey === rowKey));

      if (card.dataset.coreCardReady !== "true") {
        card.dataset.coreCardReady = "true";
        card.addEventListener(
          "click",
          (event) => {
            if (event.target.closest(".interest-button, .top-news-source-link, .project-detail-link")) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            toggleTopNewsRow(card);
          },
          true,
        );
        card.addEventListener(
          "keydown",
          (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            if (event.target.closest(".interest-button, .top-news-source-link, .project-detail-link")) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            toggleTopNewsRow(card);
          },
          true,
        );
      }

      ensureTopNewsBadges(card, row);
      ensureOpenHint(card);
      renderTopNewsDetail(card, row, expandedTopNewsRowKey === rowKey);
    });
  }

  function getTopNewsColumnCount() {
    const grid = document.getElementById("topNewsCards");
    if (!grid) return 1;
    const columns = getComputedStyle(grid).gridTemplateColumns;
    if (!columns || columns === "none") return 1;
    return Math.max(1, columns.split(" ").filter(Boolean).length);
  }

  function toggleTopNewsRow(card) {
    const rowKey = card.dataset.topNewsRowKey || "row-0";
    expandedTopNewsRowKey = expandedTopNewsRowKey === rowKey ? "" : rowKey;
    enhanceTopNewsCards();
  }

  function ensureTopNewsBadges(card, row) {
    const badgeGroups = [...card.querySelectorAll(".top-news-badges")];
    const wrap = badgeGroups[0] || document.createElement("div");
    badgeGroups.slice(1).forEach((group) => group.remove());
    if (!wrap.parentElement) {
      wrap.className = "top-news-badges";
      const title = card.querySelector("h3");
      title?.insertAdjacentElement("afterend", wrap);
    }

    const keyword = clean(row?.["주제"]);
    const infoClass = clean(row?.["정보 분류"]);
    const signature = [infoClass, keyword].join("|") || "static";
    if (wrap.dataset.badgeSignature === signature) return;

    wrap.innerHTML = [
      infoClass ? `<span class="top-news-badge is-info">${escapeHtml(infoClass)}</span>` : "",
      keyword ? `<span class="top-news-badge is-keyword">${escapeHtml(keyword)}</span>` : "",
    ].join("");
    wrap.dataset.badgeSignature = signature;
  }

  function ensureOpenHint(card) {
    card.querySelectorAll(".top-news-open-hint").forEach((hint) => hint.remove());
  }

  function renderTopNewsDetail(card, row, isExpanded) {
    let detail = card.querySelector(":scope > .top-news-card-detail");
    if (!isExpanded || !row) {
      detail?.remove();
      return;
    }

    if (!detail) {
      detail = document.createElement("div");
      detail.className = "top-news-card-detail";
      card.appendChild(detail);
    }

    const originalTitle = row["제목(원문)"] || row["제목(한글)"] || "원문 제목 없음";
    const summary = row["내용"] || "내용 요약이 없습니다.";
    detail.innerHTML = `
      <h4>${escapeHtml(originalTitle)}</h4>
      ${row["프로젝트명"] ? renderProjectLink(row) : ""}
      <p>${escapeHtml(summary)}</p>
      <div class="top-news-detail-meta">
        ${row["정보 분류"] ? `<span><strong>정보 분류</strong> ${escapeHtml(row["정보 분류"])}</span>` : ""}
        ${row["관련 단계"] ? `<span><strong>관련 단계</strong> ${escapeHtml(row["관련 단계"])}</span>` : ""}
        ${row["출처언어"] ? `<span><strong>출처언어</strong> ${escapeHtml(row["출처언어"])}</span>` : ""}
        ${row["출처링크"] ? `<a class="top-news-source-link" href="${escapeAttribute(row["출처링크"])}" target="_blank" rel="noreferrer">원문 링크 열기</a>` : ""}
      </div>`;
  }

  function renderProjectLink(row) {
    const params = new URLSearchParams();

    if (row["프로젝트명"]) params.set("name", row["프로젝트명"]);
    if (row["국가"]) params.set("country", row["국가"]);
    if (row["섹터"]) params.set("sector", row["섹터"]);
    return `
      <div class="project-callout top-news-project-callout">
        <div>
          <strong>프로젝트명</strong>
          <span>${escapeHtml(row["프로젝트명"])}</span>
        </div>
        <a class="project-detail-link" href="./project.html?${params.toString()}">프로젝트 상세페이지</a>
      </div>`;
  }

  function findArticleForCard(card) {
    const stateRows = window.state?.filteredRows || [];
    const title = normalize(card.querySelector("h3")?.textContent);
    const sourceUrl = normalizeUrl(card.querySelector("h3 a")?.getAttribute("href") || "");
    return stateRows.find((row) => {
      const rowTitle = normalize(row["제목(한글)"] || row["제목(원문)"]);
      const rowUrl = normalizeUrl(row["출처링크"] || "");
      return (sourceUrl && rowUrl && sourceUrl === rowUrl) || (title && rowTitle && title === rowTitle);
    });
  }

  function enhanceFeaturedProjectCards() {
    document.querySelectorAll(".featured-project-card").forEach((card) => {
      const link = card.querySelector("a");
      if (!link) return;
      const badgeGroups = [...link.querySelectorAll(".featured-project-badges")];
      const wrap = badgeGroups[0] || document.createElement("span");
      badgeGroups.slice(1).forEach((group) => group.remove());
      if (!wrap.parentElement) {
        wrap.className = "featured-project-badges";
        link.appendChild(wrap);
      }

      const cost = clean(card.querySelector(".featured-cost")?.textContent);
      const metaParts = clean(card.querySelector(".featured-meta")?.textContent).split("·").map(clean).filter(Boolean);
      const keyword = clean(card.querySelector(".featured-keyword")?.textContent);
      const signature = [cost, metaParts[2], keyword].join("|");
      if (wrap.dataset.badgeSignature === signature) return;

      wrap.innerHTML = [
        cost ? `<span class="featured-project-badge is-cost">${escapeHtml(cost)}</span>` : "",
        metaParts[2] ? `<span class="featured-project-badge is-stage">${escapeHtml(metaParts[2])}</span>` : "",
        keyword && keyword !== "키워드 미확인" ? `<span class="featured-project-badge">${escapeHtml(keyword)}</span>` : "",
      ].join("");
      wrap.dataset.badgeSignature = signature;
    });
  }

  function markDatePresets() {
    document.querySelectorAll(".date-preset-button").forEach((button) => {
      button.title = "클릭하면 기간이 바로 적용됩니다.";
    });
  }

  function injectStyles() {
    if (document.getElementById("monitorCoreUiStyle")) return;
    const style = document.createElement("style");
    style.id = "monitorCoreUiStyle";
    style.textContent = `
      @media (min-width:1120px){
        .market-dashboard{display:grid !important;grid-template-columns:minmax(300px,360px) minmax(0,1fr) !important;gap:14px !important;align-items:start !important;width:min(1680px,100%) !important;padding:18px clamp(12px,2vw,28px) 34px !important}
        .market-dashboard>.market-filter-panel{grid-column:1 !important;grid-row:1 / span 2 !important;position:sticky !important;top:12px !important;align-self:start !important;width:auto !important;max-height:calc(100vh - 24px) !important;margin:0 !important;padding:12px !important;overflow-x:hidden !important;overflow-y:auto !important;transform:none !important;scrollbar-gutter:stable}
        .market-dashboard>.market-results-section{grid-column:2 !important;grid-row:1 / span 2 !important;min-width:0 !important;margin:0 !important}
        .dashboard:not(.market-dashboard){display:grid !important;grid-template-columns:minmax(300px,360px) minmax(0,1fr) !important;gap:14px !important;align-items:start !important;width:min(1680px,100%) !important;padding:18px clamp(12px,2vw,28px) 34px !important}
        .dashboard:not(.market-dashboard)>.control-panel{grid-column:1 !important;grid-row:1 / span 3 !important;position:sticky !important;top:12px !important;align-self:start !important;width:auto !important;max-height:calc(100vh - 24px) !important;margin:0 !important;padding:12px !important;overflow-x:hidden !important;overflow-y:auto !important;transform:none !important;scrollbar-gutter:stable}
        .dashboard:not(.market-dashboard)>.featured-projects,.dashboard:not(.market-dashboard)>.results-section{grid-column:2 !important;min-width:0 !important;margin:0 !important}
        .dashboard:not(.market-dashboard)>.featured-projects{grid-row:1 !important}
        .dashboard:not(.market-dashboard)>.results-section{grid-row:2 !important}
        .control-panel>.summary-grid{display:grid !important;grid-template-columns:repeat(2,minmax(0,1fr)) !important;gap:6px !important;margin:0 0 10px !important}
      }
      body:has(#projectContent) .dashboard{display:block !important;width:min(1120px,calc(100% - 48px)) !important;max-width:1120px !important;margin:0 auto !important;padding:18px 24px 88px !important}
      body:has(#projectContent) .project-section{width:100% !important;max-width:none !important;margin:0 auto !important;padding:clamp(20px,2.5vw,34px) !important;overflow:hidden !important;transform:none !important}
      body:has(#projectContent) .project-toolbar{display:flex !important;align-items:flex-start !important;justify-content:space-between !important;flex-wrap:wrap !important;gap:14px 18px !important;margin-bottom:18px !important;padding-bottom:18px !important;border-bottom:1px solid rgba(15,45,79,.09) !important}
      body:has(#projectContent) .project-title-block{flex:1 1 520px !important;min-width:0 !important}
      body:has(#projectContent) .project-title-block h2{max-width:760px !important;font-size:clamp(1.45rem,2.1vw,2rem) !important;line-height:1.28 !important;letter-spacing:0 !important;overflow-wrap:anywhere;word-break:keep-all}
      body:has(#projectContent) .project-title-block p{margin-top:8px !important;font-size:.9rem !important;line-height:1.45 !important}
      body:has(#projectContent) .project-back-link{flex:0 0 auto !important;white-space:nowrap !important}
      body:has(#projectContent) #projectContent{min-width:0 !important}
      body:has(#projectContent) .project-meta-grid{display:grid !important;grid-template-columns:repeat(auto-fit,minmax(190px,1fr)) !important;gap:10px !important;margin:0 0 18px !important}
      body:has(#projectContent) .project-meta-card{display:grid !important;align-content:start !important;min-width:0 !important;min-height:94px !important;padding:14px 15px !important;border-radius:10px !important;box-shadow:0 8px 20px rgba(15,45,79,.055) !important}
      body:has(#projectContent) .project-meta-card:nth-child(4),body:has(#projectContent) .project-meta-card:nth-child(5),body:has(#projectContent) .project-meta-card:nth-child(6){grid-column:span 2}
      body:has(#projectContent) .project-meta-card span{font-size:.74rem !important;line-height:1.2 !important;letter-spacing:0 !important}
      body:has(#projectContent) .project-meta-card strong{min-width:0 !important;margin-top:8px !important;font-size:.92rem !important;line-height:1.42 !important;letter-spacing:0 !important;white-space:normal !important;overflow-wrap:anywhere;word-break:keep-all}
      body:has(#projectContent) .project-articles{gap:12px !important;margin-top:0 !important}
      body:has(#projectContent) .project-article-card{min-width:0 !important;padding:clamp(16px,2vw,22px) !important;border-radius:12px !important;box-shadow:0 10px 24px rgba(15,45,79,.06) !important}
      body:has(#projectContent) .project-article-card h3{font-size:clamp(1rem,1.3vw,1.18rem) !important;line-height:1.42 !important;letter-spacing:0 !important;overflow-wrap:anywhere;word-break:keep-all}
      body:has(#projectContent) .project-article-card p{font-size:.92rem !important;line-height:1.72 !important;overflow-wrap:anywhere;word-break:keep-all}
      body:has(#projectContent) .project-article-meta{gap:7px !important}
      body:has(#projectContent) .project-article-meta span,body:has(#projectContent) .project-article-meta a{max-width:100% !important;min-height:28px !important;font-size:.76rem !important;line-height:1.2 !important;white-space:normal !important;overflow-wrap:anywhere}
      body:has(#projectContent) .project-interest-box{flex:0 1 260px !important;min-width:230px !important;margin-left:auto !important}
      @media (max-width:920px){body:has(#projectContent) .dashboard{width:100% !important;padding-inline:12px !important}body:has(#projectContent) .project-meta-grid{grid-template-columns:repeat(2,minmax(0,1fr)) !important}body:has(#projectContent) .project-meta-card:nth-child(4),body:has(#projectContent) .project-meta-card:nth-child(5),body:has(#projectContent) .project-meta-card:nth-child(6){grid-column:auto !important}body:has(#projectContent) .project-interest-box{width:100% !important;min-width:0 !important;margin-left:0 !important}}
      @media (max-width:620px){body:has(#projectContent) .dashboard{padding:10px 8px 88px !important}body:has(#projectContent) .project-section{padding:14px !important;border-radius:14px !important}body:has(#projectContent) .project-toolbar{align-items:stretch !important;flex-direction:column !important}body:has(#projectContent) .project-back-link{width:100% !important}body:has(#projectContent) .project-meta-grid{grid-template-columns:1fr !important}body:has(#projectContent) .project-meta-card{min-height:auto !important}}
      .filter-top-actions{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:end;gap:8px;margin:0 0 10px}
      .top-reset-button{display:inline-flex !important;align-items:center !important;justify-content:center !important;min-height:32px !important;padding:0 12px !important;border:1px solid rgba(13,77,132,.18) !important;border-radius:8px !important;background:linear-gradient(180deg,#1f6fb2,#155895) !important;color:#fff !important;box-shadow:0 7px 16px rgba(21,88,149,.18) !important;font-size:.68rem !important;font-weight:900 !important;line-height:1 !important;white-space:nowrap;cursor:pointer}
      .top-reset-button:hover{background:linear-gradient(180deg,#2b7fc6,#17609f) !important;transform:translateY(-1px)}
      .top-reset-button:active{transform:translateY(0)}
      .sort-field-top{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:6px;min-width:0;margin-left:0}
      .sort-field-top label,.sort-field-top .sort-label-row{margin:0;white-space:nowrap;font-size:.68rem !important}
      .sort-field-top select{min-width:0;min-height:32px !important;padding-inline:8px !important;border-radius:8px !important;font-size:.7rem !important}
      .filter-collapse{width:100%}
      .filter-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:34px;padding:7px 9px;border:1px solid rgba(30,41,59,.14);border-radius:8px;background:#fff;cursor:pointer;list-style:none}
      .filter-summary::-webkit-details-marker{display:none}
      .filter-summary::after{content:"v";margin-left:auto;color:#64748b;font-size:.72rem;transition:transform .16s ease}
      .filter-collapse[open] .filter-summary::after{transform:rotate(180deg)}
      .filter-summary-title{font-weight:800;font-size:.68rem}
      .filter-summary-count{font-size:.64rem;color:#64748b;white-space:nowrap}
      .filter-collapse[open] .filter-summary{border-bottom-left-radius:0;border-bottom-right-radius:0;background:#f8fbff}
      .filter-options-panel{padding:6px;border:1px solid rgba(30,41,59,.12);border-top:0;border-bottom-left-radius:8px;border-bottom-right-radius:8px;background:#fff}
      .filter-bulk-toggle{width:100%;min-height:28px;margin:0 0 6px;padding:0 9px;border:1px solid rgba(30,41,59,.12);border-radius:7px;background:#f8fafc;color:#25415f;font-size:.65rem;font-weight:900;cursor:pointer}
      .filter-bulk-toggle:hover{background:#eef6ff;border-color:rgba(21,88,149,.24)}
      .filter-collapse .checkbox-filter{max-height:230px;overflow-y:auto;overscroll-behavior:contain;padding:0 2px 2px 0;scrollbar-width:thin}
      .filter-collapse .checkbox-filter::-webkit-scrollbar{width:8px}
      .filter-collapse .checkbox-filter::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:999px}
      .control-panel .summary-item{min-height:54px !important;padding:8px 9px !important;border-radius:9px !important}
      .control-panel .summary-item::before{top:8px !important;right:8px !important;width:16px !important;height:16px !important;border-radius:6px !important}
      .control-panel .summary-item::after{display:none !important}
      .control-panel .summary-item span{max-width:calc(100% - 18px) !important;font-size:.58rem !important;line-height:1.18 !important;letter-spacing:0 !important}
      .control-panel .summary-item strong{margin-top:5px !important;font-size:1.02rem !important;letter-spacing:0 !important}
      .control-panel label,.control-panel .field-label,.control-panel .filter-section-label{font-size:.68rem !important;letter-spacing:0 !important}
      .control-panel .search-field label{font-size:.76rem !important}
      .control-panel input,.control-panel select,.control-panel .search-field input{min-height:34px !important;padding-inline:9px !important;border-radius:9px !important;font-size:.72rem !important}
      .control-panel .date-preset-row{gap:5px !important}
      .control-panel .date-preset-button,.control-panel .panel-actions button{min-height:28px !important;padding:0 9px !important;font-size:.66rem !important}
      .control-panel .check-chip span,.control-panel .cost-toggle span{min-height:23px !important;padding:0 7px !important;font-size:.63rem !important}
      .control-panel .checkbox-filter{gap:4px !important;min-height:30px !important;padding:0 !important}
      .control-panel #activeFilterText{min-height:27px !important;padding:5px 8px !important;font-size:.64rem !important;line-height:1.3 !important}
      .control-panel .panel-actions #resetButton{display:none}
      .control-panel .panel-actions .action-buttons{grid-template-columns:1fr !important}
      .top-news-card{cursor:pointer}
      .top-news-card:hover,.top-news-card:focus{transform:translateY(-1px)}
      .top-news-card[aria-expanded="true"]{border-color:rgba(19,92,155,.34);box-shadow:0 16px 30px rgba(18,40,72,.12)}
      .top-news-rank,.top-news-foot span:first-child,.top-news-card>p{display:none !important}
      .top-news-badges,.featured-project-badges{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
      .top-news-badge,.featured-project-badge{display:inline-flex;align-items:center;min-height:24px;padding:3px 8px;border-radius:999px;background:#eef2ff;color:#3730a3;font-size:.74rem;font-weight:800}
      .top-news-badge.is-info,.featured-project-badge.is-stage{background:#ecfdf5;color:#047857}
      .top-news-badge.is-keyword{background:#f8fafc;color:#334155}
      .featured-project-badge.is-cost{background:#fff7ed;color:#9a3412}
      .top-news-open-hint{display:none !important}
      .top-news-card-detail{display:grid;gap:9px;margin-top:12px;padding-top:12px;border-top:1px solid rgba(42,65,97,.12)}
      .top-news-card-detail h4{margin:0;color:#0f2742;font-size:.82rem;font-weight:950;line-height:1.38}
      .top-news-card-detail p{display:block !important;max-height:none !important;margin:0;color:#44546a;font-size:.76rem;font-weight:650;line-height:1.58;overflow:visible !important;-webkit-line-clamp:unset !important;-webkit-box-orient:initial !important}
      .top-news-detail-meta{display:flex;flex-wrap:wrap;gap:6px;color:#526276;font-size:.7rem;font-weight:750}
      .top-news-detail-meta span,.top-news-detail-meta a{display:inline-flex;align-items:center;min-height:24px;padding:3px 7px;border-radius:999px;background:#f1f7ff;text-decoration:none}
      .top-news-detail-meta a{color:#1253a4;font-weight:900}
      .top-news-project-callout{align-items:flex-start;margin:0;padding:9px 10px;border-radius:9px}
      .top-news-project-callout .project-detail-link{min-height:30px;padding:0 10px;font-size:.72rem}
      @media (max-width:720px){
        .filter-top-actions{grid-template-columns:1fr;align-items:stretch}
        .sort-field-top{width:100%;margin-left:0;grid-template-columns:auto minmax(0,1fr)}
      }
    `;
    document.head.appendChild(style);
  }

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalize(value) {
    return clean(value).toLowerCase();
  }

  function normalizeUrl(value) {
    try {
      const url = new URL(value, window.location.href);
      url.hash = "";
      ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"].forEach((key) => url.searchParams.delete(key));
      const query = url.searchParams.toString();
      return `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}${query ? `?${query}` : ""}`.toLowerCase();
    } catch (error) {
      return normalize(value).replace(/\/$/, "");
    }
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replaceAll("`", "&#096;");
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("ko-KR").format(Number(value || 0));
  }
})();

;

/* =========================================================
   source: view-tracking.js
   ========================================================= */

(() => {
  const TRACKING_ENDPOINT = getTrackingEndpoint();
  const SESSION_KEY = "icakViewSessionId";
  const BROWSER_KEY = "icakViewBrowserId";
  const DEDUPE_KEY = "icakViewEventDedupe";
  const MARKET_DEDUPE_KEY = "icakViewMarketVisitDedupe";
  const DEDUPE_WINDOW_MS = 5 * 60 * 1000;

  window.ViewTracking = {
    enabled: Boolean(TRACKING_ENDPOINT),
    track,
    getCounts,
  };

  document.addEventListener("DOMContentLoaded", () => {
    loadCountCache();
    trackMarketPageVisit();
    trackProjectPageOpen();
  });

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (link) {
      handleLinkClick(link);
      return;
    }

    const detailButton = event.target.closest(".detail-button");
    if (detailButton) {
      const row = detailButton.closest("tr[data-article-id]");
      scheduleArticleDetailTrack(row?.dataset.articleId, detailButton);
      return;
    }

    const topNewsCard = event.target.closest("#topNewsCards .top-news-card");
    if (topNewsCard) {
      scheduleArticleDetailTrack(topNewsCard.dataset.articleId, topNewsCard);
      return;
    }

    const row = event.target.closest("tr[data-article-id]");
    if (row && !event.target.closest("button, a")) {
      scheduleArticleDetailTrack(row.dataset.articleId, row);
    }
  });

  function handleLinkClick(link) {
    const href = link.getAttribute("href") || "";
    const url = new URL(href, window.location.href);

    if (isProjectDetailLink(url, link)) {
      const projectId = getProjectIdFromUrl(url);
      if (projectId) track("project_detail_open", projectId, { targetType: "project", sourceUrl: url.toString() });
      return;
    }

    if (!isSourceLink(url, link)) return;
    const articleId = findArticleId(link);
    if (articleId) track("source_link_click", articleId, { targetType: "article", sourceUrl: url.toString() });
  }

  function scheduleArticleDetailTrack(articleId, trigger) {
    if (!articleId) return;
    setTimeout(() => {
      if (isExpanded(trigger, articleId)) track("article_detail_open", articleId, { targetType: "article" });
    }, 0);
  }

  function isExpanded(trigger, articleId) {
    if (!trigger) return false;
    if (trigger.matches?.(".top-news-card")) return trigger.getAttribute("aria-expanded") === "true";
    const row = trigger.closest?.("tr[data-article-id]") || trigger;
    const button = row.querySelector?.(".detail-button");
    if (button?.getAttribute("aria-expanded") === "true") return true;
    return Boolean(document.querySelector(`tr.detail-row[data-detail-for="${cssEscape(articleId)}"]`));
  }

  function track(eventType, targetId, options = {}) {
    if (!TRACKING_ENDPOINT || !targetId) return;
    const sessionId = getSessionId();
    const browserId = getBrowserId();
    if (shouldDedupe(eventType, targetId, { sessionId, browserId })) return;
    const payload = {
      event_type: eventType,
      target_type: options.targetType || inferTargetType(eventType),
      target_id: String(targetId),
      session_id: sessionId,
      browser_id: browserId,
      source_url: options.sourceUrl || "",
      page_path: `${window.location.pathname}${window.location.search}`,
      event_date_kst: getKstDateKey(),
    };
    sendPayload(payload);
  }

  function sendPayload(payload) {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(TRACKING_ENDPOINT, blob)) return;
    }
    fetch(TRACKING_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  }

  async function loadCountCache() {
    try {
      const response = await fetch("./data/view-counts.json", { cache: "no-cache" });
      if (!response.ok) return;
      window.ViewCounts = await response.json();
    } catch (error) {
      window.ViewCounts = { counts: {}, rows: [] };
    }
  }

  function getCounts(targetType, targetId) {
    return window.ViewCounts?.counts?.[targetType]?.[targetId] || {};
  }

  function trackMarketPageVisit() {
    if (!isMarketPage()) return;
    track("market_page_visit", "market-home", { targetType: "page" });
  }

  function trackProjectPageOpen() {
    if (!/project\.html$/i.test(window.location.pathname)) return;
    const projectId = getProjectIdFromUrl(new URL(window.location.href));
    if (projectId) track("project_detail_open", projectId, { targetType: "project" });
  }

  function isMarketPage() {
    const path = window.location.pathname.replace(/\/+$/, "");
    return path === "" || path === "/" || /\/index\.html$/i.test(window.location.pathname);
  }

  function isProjectDetailLink(url, link) {
    return link.classList.contains("project-detail-link") || /project\.html$/i.test(url.pathname);
  }

  function isSourceLink(url, link) {
    if (url.origin === window.location.origin && /\.html$/i.test(url.pathname)) return false;
    if (link.closest(".page-nav, .brand, .project-back-link")) return false;
    return Boolean(findArticleId(link));
  }

  function findArticleId(node) {
    const articleNode = node.closest("[data-article-id]");
    if (articleNode?.dataset.articleId) return articleNode.dataset.articleId;
    const detailRow = node.closest("tr.detail-row[data-detail-for]");
    if (detailRow) {
      const row = detailRow.previousElementSibling;
      if (row?.dataset.articleId) return row.dataset.articleId;
    }
    return "";
  }

  function getProjectIdFromUrl(url) {
    return clean(url.searchParams.get("id")) || clean(url.searchParams.get("name"));
  }

  function shouldDedupe(eventType, targetId, ids) {
    if (eventType === "market_page_visit") {
      return shouldDedupeMarketVisit(eventType, targetId, ids.browserId);
    }
    return shouldDedupeRecentEvent(eventType, targetId, ids.sessionId);
  }

  function shouldDedupeMarketVisit(eventType, targetId, browserId) {
    const dateKey = getKstDateKey();
    const dedupeKey = `${eventType}|${targetId}|${browserId}|${dateKey}`;
    const cache = readJson(MARKET_DEDUPE_KEY, {}, localStorage);
    if (cache[dedupeKey]) return true;
    cache[dedupeKey] = Date.now();
    Object.keys(cache).forEach((itemKey) => {
      if (!itemKey.endsWith(`|${dateKey}`)) delete cache[itemKey];
    });
    writeJson(MARKET_DEDUPE_KEY, cache, localStorage);
    return false;
  }

  function shouldDedupeRecentEvent(eventType, targetId, sessionId) {
    const now = Date.now();
    const key = `${eventType}|${targetId}|${sessionId}`;
    const cache = readJson(DEDUPE_KEY, {}, sessionStorage);
    const last = Number(cache[key] || 0);
    if (last && now - last < DEDUPE_WINDOW_MS) return true;
    cache[key] = now;
    Object.keys(cache).forEach((itemKey) => {
      if (now - Number(cache[itemKey] || 0) > 24 * 60 * 60 * 1000) delete cache[itemKey];
    });
    writeJson(DEDUPE_KEY, cache, sessionStorage);
    return false;
  }

  function getSessionId() {
    return getStoredId(sessionStorage, SESSION_KEY, "session-unavailable");
  }

  function getBrowserId() {
    return getStoredId(localStorage, BROWSER_KEY, "browser-unavailable");
  }

  function getStoredId(storage, key, fallback) {
    try {
      let id = storage.getItem(key);
      if (!id) {
        id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        storage.setItem(key, id);
      }
      return id;
    } catch (error) {
      return fallback;
    }
  }

  function inferTargetType(eventType) {
    if (eventType === "project_detail_open") return "project";
    if (eventType === "market_page_visit") return "page";
    return "article";
  }

  function getKstDateKey() {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(new Date());
  }

  function getTrackingEndpoint() {
    const configured = window.VIEW_TRACKING_ENDPOINT || document.querySelector('meta[name="view-tracking-endpoint"]')?.content || "";
    if (!configured) return "";
    const url = new URL(configured, window.location.href);
    if (url.pathname === "/" || !url.pathname) url.pathname = "/track";
    return url.toString();
  }

  function readJson(key, fallback, storage = sessionStorage) {
    try {
      return JSON.parse(storage.getItem(key) || JSON.stringify(fallback));
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value, storage = sessionStorage) {
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch (error) {}
  }

  function clean(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function cssEscape(value) {
    if (window.CSS?.escape) return CSS.escape(value);
    return String(value).replace(/["\\]/g, "\\$&");
  }
})();

;
