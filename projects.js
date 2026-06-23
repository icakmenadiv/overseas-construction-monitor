const CONFIG = {
  PROJECT_DATA_URL: "./data/projects.json",
  ARTICLE_DATA_URL: "./data/articles.json",
  META_URL: "./data/meta.json",
  SMALL_COST_EXCLUDE_USD: 10_000_000,
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

const INTEREST_COLUMNS = ["관심도", "관심도 집계", "관심수", "하트수", "관심도 수치"];
const STAGE_ORDER = ["study", "planning", "pre-procurement", "tender", "bid-evaluation", "awarded", "contracted", "financing", "construction", "completion", "operation", "on-hold", "cancelled"];

const state = { projects: [], filteredProjects: [], cacheMeta: null };
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
  setupCopy();
  bindEvents();
  await loadProjects();
}

function setupCopy() {
  const eyebrow = document.querySelector(".brand-wrap .eyebrow");
  const title = document.querySelector(".brand-wrap h1");
  const subtitle = document.querySelector(".brand-wrap .subtitle");
  const navLinks = document.querySelectorAll(".page-nav a");
  if (eyebrow) eyebrow.textContent = "Project Pipeline";
  if (title) title.textContent = "프로젝트 목록";
  if (subtitle) subtitle.textContent = "국가별 주요 프로젝트의 단계, 규모, 관련 기사를 이어서 확인합니다.";
  if (navLinks[0]) navLinks[0].textContent = "해외 건설시장 뉴스";
  if (navLinks[1]) navLinks[1].textContent = "프로젝트 목록";
  const helpText = document.querySelector(".results-section .section-head p");
  if (helpText) helpText.textContent = "프로젝트 행을 누르면 관련 기사 상세 목록을 확인할 수 있습니다.";
  syncCostLabels();
}

function bindEvents() {
  const debouncedApply = debounce(applyFilters, 220);
  els.keywordInput?.addEventListener("input", debouncedApply);
  els.sortSelect?.addEventListener("change", applyFilters);
  els.includeSmallCost?.addEventListener("change", applyFilters);
  els.includeUnknownCost?.addEventListener("change", applyFilters);
  [els.countryFilter, els.sectorFilter, els.stageFilter].forEach((el) => el?.addEventListener("change", debouncedApply));
  els.regionFilter?.addEventListener("change", () => { updateCountryOptions(); applyFilters(); });
  els.resetButton?.addEventListener("click", resetFilters);
  document.querySelectorAll("[data-reset-filter]").forEach((button) => button.addEventListener("click", resetFilters));
  els.refreshButton?.addEventListener("click", () => loadProjects({ bustCache: true }));
  els.backToTopButton?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}

async function loadProjects({ bustCache = false } = {}) {
  try {
    if (els.refreshButton) els.refreshButton.disabled = true;
    if (els.syncStatus) els.syncStatus.textContent = "캐시 데이터 새로 고침 중...";
    const [projectsPayload, articlesPayload, meta] = await Promise.all([
      fetchJson(CONFIG.PROJECT_DATA_URL, bustCache),
      fetchJson(CONFIG.ARTICLE_DATA_URL, bustCache).catch(() => []),
      fetchJson(CONFIG.META_URL, bustCache).catch(() => null),
    ]);
    const projectRows = Array.isArray(projectsPayload) ? projectsPayload : projectsPayload?.projects || [];
    const articleRows = Array.isArray(articlesPayload) ? articlesPayload : articlesPayload?.articles || [];
    const articleMeta = buildArticleMeta(articleRows);
    state.cacheMeta = meta;
    state.projects = projectRows
      .map((row, index) => normalizeProject(row, index, articleMeta))
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
  const response = await fetch(bustCache ? `${path}?t=${Date.now()}` : path, { cache: bustCache ? "reload" : "no-cache" });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${path}`);
  return response.json();
}

function buildArticleMeta(rows) {
  return rows.reduce((map, row) => {
    const id = clean(row["기사 고유값"]);
    if (!id) return map;
    map.set(id, { topic: clean(row["주제"]), interestCount: getInterestCount(row) });
    return map;
  }, new Map());
}

function normalizeProject(row, index, articleMeta) {
  const normalized = {};
  PROJECT_COLUMNS.forEach((column) => { normalized[column] = clean(row[column]); });
  const representativeArticleId = normalized["대표 기사 고유값"];
  const article = articleMeta.get(representativeArticleId) || {};
  const costText = normalized["사업비(달러 기준 추정액)"] || "사업비 미확인";
  const costValue = parseCostValue(costText);
  const latestDate = parseDate(normalized["최근 업데이트일"]);
  return {
    id: normalized["프로젝트 고유값"] || String(index),
    projectId: normalized["프로젝트 고유값"],
    name: normalized["프로젝트명"],
    region: normalized["지역"],
    country: normalized["국가"],
    sector: normalized["섹터"],
    owner: normalized["발주처"],
    costText,
    costValue,
    costKnown: costValue > 0 && !isUnknownCost(costText),
    exchangeBasis: normalized["사업비 환산 환율 / 기준"],
    stage: normalized["현재 단계"] || "-",
    latestDate,
    latestDateText: formatDate(latestDate) || normalized["최근 업데이트일"],
    representativeArticleId,
    representativeTopic: article.topic || "",
    representativeInterestCount: article.interestCount || 0,
    representativeInfoClass: normalized["대표 기사 정보 분류"] || "프로젝트 정보",
    note: normalized["비고"],
  };
}

function applyFilters() {
  const keyword = clean(els.keywordInput?.value).toLowerCase();
  const regions = getCheckedValues(els.regionFilter);
  const countries = getCheckedValues(els.countryFilter);
  const sectors = getCheckedValues(els.sectorFilter);
  const stages = getCheckedValues(els.stageFilter);
  const excludeSmall = Boolean(els.includeSmallCost?.checked);
  const excludeUnknown = Boolean(els.includeUnknownCost?.checked);
  let projects = state.projects.filter((project) => {
    const keywordOk = !keyword || [project.projectId, project.name, project.owner, project.representativeArticleId, project.representativeTopic, project.note, project.region, project.country, project.sector, project.stage].join(" ").toLowerCase().includes(keyword);
    const regionOk = !regions.length || regions.includes(project.region);
    const countryOk = !countries.length || countries.includes(project.country);
    const sectorOk = !sectors.length || sectors.includes(project.sector);
    const stageOk = !stages.length || stages.includes(project.stage);
    const costOk = (!excludeUnknown || project.costKnown) && (!excludeSmall || !isSmallCost(project));
    return keywordOk && regionOk && countryOk && sectorOk && stageOk && costOk;
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
  const [key, direction] = String(sortValue || "cost:desc").split(":");
  const m = direction === "desc" ? -1 : 1;
  return [...projects].sort((a, b) => {
    if (key === "cost") return (a.costValue - b.costValue) * m;
    if (key === "interest") return (a.representativeInterestCount - b.representativeInterestCount) * m;
    if (key === "latest") return ((a.latestDate?.getTime() || 0) - (b.latestDate?.getTime() || 0)) * m;
    if (key === "country") return a.country.localeCompare(b.country, "ko") * m;
    return a.name.localeCompare(b.name, "ko") * m;
  });
}

function populateFilters() {
  setCheckboxOptions(els.regionFilter, uniqueValues(state.projects, "region"), getCheckedValues(els.regionFilter));
  setCheckboxOptions(els.sectorFilter, uniqueValues(state.projects, "sector"), getCheckedValues(els.sectorFilter));
  setCheckboxOptions(els.stageFilter, sortStageValues(uniqueValues(state.projects, "stage").filter((value) => value !== "-")), getCheckedValues(els.stageFilter));
  updateCountryOptions();
}

function updateCountryOptions() {
  const selectedRegions = getCheckedValues(els.regionFilter);
  const source = selectedRegions.length ? state.projects.filter((project) => selectedRegions.includes(project.region)) : state.projects;
  setCheckboxOptions(els.countryFilter, uniqueValues(source, "country"), getCheckedValues(els.countryFilter));
}

function renderFeaturedProjects() {
  if (!els.featuredProjects) return;
  const featured = [...state.filteredProjects].filter((project) => project.costKnown).sort((a, b) => b.costValue - a.costValue).slice(0, 3);
  els.featuredProjects.hidden = featured.length === 0;
  els.featuredProjects.innerHTML = featured.length ? `<div class="featured-projects-head"><div><span>대표 프로젝트</span><h2>사업비 규모 기준 상위 3건</h2></div><p>현재 필터 결과에서 사업비가 확인된 프로젝트만 기준으로 표시합니다.</p></div><div class="featured-project-card-grid">${featured.map(renderFeaturedProjectCard).join("")}</div>` : "";
}

function renderFeaturedProjectCard(project, index) {
  return `<article class="featured-project-card"><a href="${escapeAttribute(buildProjectUrl(project))}" aria-label="${escapeAttribute(project.name)} 프로젝트 상세페이지 열기"><span class="featured-rank">Top ${index + 1}</span><strong>${escapeHtml(project.name)}</strong><span class="featured-cost">${escapeHtml(formatCost(project))}</span><span class="featured-meta">${escapeHtml(project.country || "-")} · ${escapeHtml(project.sector || "-")} · ${escapeHtml(project.stage || "-")}</span><span class="featured-keyword">${escapeHtml(project.representativeTopic || "키워드 미확인")}</span></a></article>`;
}

function renderProjects() {
  if (els.loadingState) els.loadingState.hidden = true;
  if (els.errorState) els.errorState.hidden = true;
  if (els.emptyState) els.emptyState.hidden = state.filteredProjects.length > 0;
  if (els.tableWrap) els.tableWrap.hidden = state.filteredProjects.length === 0;
  if (!els.projectBody) return;
  const fragment = document.createDocumentFragment();
  state.filteredProjects.forEach((project) => fragment.appendChild(createProjectRow(project)));
  els.projectBody.replaceChildren(fragment);
}

function createProjectRow(project) {
  const url = buildProjectUrl(project);
  const tr = document.createElement("tr");
  tr.className = "project-row-link";
  tr.tabIndex = 0;
  tr.setAttribute("role", "link");
  tr.setAttribute("aria-label", `${project.name} 프로젝트 상세페이지 열기`);
  tr.innerHTML = `<td class="project-title-cell" data-label="프로젝트명"><a class="title-link" href="${escapeAttribute(url)}">${escapeHtml(project.name)}</a></td><td data-label="지역"><span class="pill">${escapeHtml(project.region || "-")}</span></td><td data-label="국가">${escapeHtml(project.country || "-")}</td><td data-label="섹터">${escapeHtml(project.sector || "-")}</td><td data-label="키워드"><span class="keyword-pill">${escapeHtml(project.representativeTopic || "-")}</span></td><td data-label="발주처">${escapeHtml(project.owner || "-")}</td><td data-label="사업비(USD)">${escapeHtml(formatCost(project))}</td><td data-label="현재 단계"><span class="pill stage-pill">${escapeHtml(project.stage || "-")}</span></td><td class="date-cell" data-label="최근 업데이트일">${escapeHtml(project.latestDateText)}</td>`;
  tr.addEventListener("click", (event) => { if (!event.target.closest("a")) window.location.href = url; });
  tr.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); window.location.href = url; } });
  return tr;
}

function updateSummary() {
  const latest = state.projects.map((project) => project.latestDate).filter(Boolean).sort((a, b) => b.getTime() - a.getTime())[0];
  if (els.totalCount) els.totalCount.textContent = numberFormat(state.projects.length);
  if (els.filteredCount) els.filteredCount.textContent = numberFormat(state.filteredProjects.length);
  if (els.countryCount) els.countryCount.textContent = numberFormat(uniqueValues(state.projects, "country").length);
  if (els.sectorCount) els.sectorCount.textContent = numberFormat(uniqueValues(state.projects, "sector").length);
  if (els.latestDate) els.latestDate.textContent = latest ? formatDate(latest) : "-";
  if (els.resultCountLabel) els.resultCountLabel.textContent = `${numberFormat(state.filteredProjects.length)}건`;
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
  if (els.activeFilterText) els.activeFilterText.textContent = filters.join(" · ");
}

function resetFilters() {
  if (els.keywordInput) els.keywordInput.value = "";
  [els.regionFilter, els.countryFilter, els.sectorFilter, els.stageFilter].forEach(clearCheckedValues);
  if (els.includeSmallCost) els.includeSmallCost.checked = true;
  if (els.includeUnknownCost) els.includeUnknownCost.checked = true;
  if (els.sortSelect) els.sortSelect.value = "cost:desc";
  updateCountryOptions();
  applyFilters();
}

function syncCostLabels() {
  const smallLabel = els.includeSmallCost?.closest("label")?.querySelector("span");
  const unknownLabel = els.includeUnknownCost?.closest("label")?.querySelector("span");
  if (smallLabel) smallLabel.textContent = "1천만불 이하 제외";
  if (unknownLabel) unknownLabel.textContent = "사업비 미포함 제외";
}

function updateSyncStatus() {
  if (!els.syncStatus) return;
  const updatedAt = state.cacheMeta?.updatedAt;
  els.syncStatus.textContent = updatedAt ? `캐시 기준 ${formatDateTime(new Date(updatedAt))}` : `캐시 기준 ${formatDateTime(new Date())}`;
}

function showError() {
  if (els.loadingState) els.loadingState.hidden = true;
  if (els.errorState) {
    els.errorState.hidden = false;
    els.errorState.textContent = "캐시 데이터를 불러오지 못했습니다. GitHub Actions의 시트 동기화 실행 상태를 확인해주세요.";
  }
  if (els.emptyState) els.emptyState.hidden = true;
  if (els.tableWrap) els.tableWrap.hidden = true;
  if (els.featuredProjects) els.featuredProjects.hidden = true;
  if (els.syncStatus) els.syncStatus.textContent = "캐시 데이터 연결 실패";
}

function buildProjectUrl(project) {
  const params = new URLSearchParams();
  if (project.projectId) params.set("id", project.projectId);
  params.set("name", project.name);
  if (project.country) params.set("country", project.country);
  if (project.sector) params.set("sector", project.sector);
  return `./project.html?${params.toString()}`;
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
  return project.costKnown && project.costValue <= CONFIG.SMALL_COST_EXCLUDE_USD;
}

function formatCost(project) {
  if (!project.costKnown) return "사업비 미확인";
  if (project.costValue >= CONFIG.HUNDRED_MILLION_USD) return `${formatCompactAmount(project.costValue / CONFIG.HUNDRED_MILLION_USD)}억불`;
  return `${formatCompactAmount(project.costValue / CONFIG.MILLION_USD)}백만불`;
}

function formatCompactAmount(value) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? numberFormat(rounded) : numberFormat(rounded).replace(/\.0$/, "");
}

function parseDate(value) {
  if (!value) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value > 20000 ? new Date(Math.round((value - 25569) * 86400 * 1000)) : null;
  const text = String(value).trim();
  const serial = Number(text);
  if (Number.isFinite(serial) && serial > 20000) return new Date(Math.round((serial - 25569) * 86400 * 1000));
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

function sortStageValues(values) {
  return [...values].sort((a, b) => (getStageRank(a) - getStageRank(b)) || a.localeCompare(b, "ko"));
}

function getStageRank(value) {
  const normalized = String(value || "").toLowerCase().replace(/[–—_]/g, "-").replace(/\s+/g, " ").trim();
  const exact = STAGE_ORDER.indexOf(normalized);
  if (exact !== -1) return exact;
  const partial = STAGE_ORDER.findIndex((stage) => normalized.includes(stage) || stage.includes(normalized));
  return partial === -1 ? 999 : partial;
}

function setCheckboxOptions(container, values, selectedValues = []) {
  if (!container) return;
  const selected = new Set(selectedValues);
  const fragment = document.createDocumentFragment();
  if (!values.length) {
    const empty = document.createElement("span");
    empty.className = "checkbox-empty";
    empty.textContent = "선택 가능한 항목 없음";
    fragment.appendChild(empty);
  } else {
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
      fragment.appendChild(label);
    });
  }
  container.replaceChildren(fragment);
}

function getCheckedValues(container) {
  if (!container) return [];
  return [...container.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value);
}

function clearCheckedValues(container) {
  container?.querySelectorAll('input[type="checkbox"]').forEach((input) => { input.checked = false; });
}

function uniqueValues(rows, key) {
  return [...new Set(rows.map((row) => row[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
}

function pushSelectedFilter(filters, label, values) {
  if (!values.length) return;
  filters.push(`${label}: ${values[0]}${values.length > 1 ? ` 외 ${values.length - 1}` : ""}`);
}

function getInterestCount(row) {
  for (const column of INTEREST_COLUMNS) {
    const value = Number(String(row?.[column] || "").replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function numberFormat(value) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatDateTime(date) {
  if (!date || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
