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
  if (project.projectId) params.set("id", project.projectId);
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
