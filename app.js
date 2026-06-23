const CONFIG = {
  SHEET_VIEW_URL:
    "https://docs.google.com/spreadsheets/d/11WmfuDj7FSk5LRvEB2CArVETZOA9NgpySLYscG223-E/edit?gid=748239675#gid=748239675",
  DATA_URL: "./data/articles.json",
  META_URL: "./data/meta.json",
  SHEET_ID: "11WmfuDj7FSk5LRvEB2CArVETZOA9NgpySLYscG223-E",
  RESULT_GID: "748239675",
  RESULT_RANGE: "A1:S50000",
  DEFAULT_PERIOD_DAYS: 7,
  DISPLAY_LIMIT: 200,
  TOP_NEWS_LIMIT: 6,
};

const INFO_CLASS_ORDER = [
  "프로젝트 정보",
  "정부/민간 인프라투자 동향",
  "정부/민간 인프라 투자동향",
  "인프라 투자 동향",
  "건설관련 법령 제개정",
  "건설 관련 법령 제·개정",
  "외국기업 동향",
  "외국 기업 동향",
  "일반 동향",
];

const INFO_CLASS_FILTER_LABELS = {
  "인프라 투자 동향": "정부/민간 인프라투자 동향",
  "정부/민간 인프라 투자동향": "정부/민간 인프라투자 동향",
  "건설 관련 법령 제·개정": "건설관련 법령 제개정",
  "외국 기업 동향": "외국기업 동향",
};

const REQUIRED_COLUMNS = [
  "원문게재일",
  "기사수집일",
  "지역",
  "국가",
  "섹터",
  "주제",
  "정보 분류",
  "프로젝트 고유값",
  "프로젝트명",
  "기사 고유값",
  "관련 단계",
  "제목(한글)",
  "제목(원문)",
  "내용",
  "중요도",
  "담당자 활용시 체크",
  "출처언어",
  "출처링크",
];

const EXPORT_COLUMNS = [
  "원문게재일",
  "기사수집일",
  "지역",
  "국가",
  "섹터",
  "주제",
  "정보 분류",
  "프로젝트명",
  "관련 단계",
  "제목(한글)",
  "제목(원문)",
  "내용",
  "중요도",
  "출처언어",
  "출처링크",
];

const INTEREST_COUNT_COLUMNS = ["관심도", "관심도 집계", "관심수", "하트수", "관심도 수치"];

const state = {
  rows: [],
  filteredRows: [],
  expanded: new Set(),
  highPriorityOnly: false,
  cacheMeta: null,
};

window.state = state;

let savedFilterState = null;

const els = {
  sheetLink: document.getElementById("sheetLink"),
  footerSheetLink: document.getElementById("footerSheetLink"),
  syncStatus: document.getElementById("syncStatus"),
  keywordInput: document.getElementById("keywordInput"),
  startDate: document.getElementById("startDate"),
  endDate: document.getElementById("endDate"),
  regionFilter: document.getElementById("regionFilter"),
  countryFilter: document.getElementById("countryFilter"),
  sectorFilter: document.getElementById("sectorFilter"),
  infoClassFilter: document.getElementById("infoClassFilter"),
  sortSelect: document.getElementById("sortSelect"),
  resetButton: document.getElementById("resetButton"),
  refreshButton: document.getElementById("refreshButton"),
  exportButton: document.getElementById("exportButton"),
  highPriorityButton: document.getElementById("highPriorityButton"),
  datePresetButtons: document.querySelectorAll(".date-preset-button"),
  topNewsSection: document.getElementById("topNewsSection"),
  topNewsCards: document.getElementById("topNewsCards"),
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
  resultBody: document.getElementById("resultBody"),
  limitNotice: document.getElementById("limitNotice"),
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  setupUnifiedHeader();
  setupActionLabels();
  enableHoverFilters();
  if (els.sheetLink) els.sheetLink.href = CONFIG.SHEET_VIEW_URL;
  if (els.footerSheetLink) els.footerSheetLink.href = CONFIG.SHEET_VIEW_URL;
  loadFilterState();
  bindEvents();
  setDefaultDates();
  syncHighPriorityButton();
  syncDatePresetButtons();
  await loadData();
}

function setupUnifiedHeader() {
  const eyebrow = document.querySelector(".brand-wrap .eyebrow");
  const title = document.querySelector(".brand-wrap h1");
  const subtitle = document.querySelector(".brand-wrap .subtitle");
  if (eyebrow) eyebrow.textContent = "해외건설협회 통합 모니터링";
  if (title) title.textContent = "해외 건설시장 모니터링";
  if (subtitle) {
    subtitle.textContent = "해외건설협회가 수집한 해외 건설·인프라 시장뉴스와 프로젝트 정보를 통합 조회합니다.";
  }
}

function setupActionLabels() {
  if (els.resetButton) els.resetButton.textContent = "필터 초기화";
  if (els.exportButton) {
    els.exportButton.textContent = "📥 목록 다운로드";
    els.exportButton.title = "CSV 목록 다운로드";
  }
  if (els.highPriorityButton) {
    els.highPriorityButton.innerHTML = `중요도 '상' 기사만 보기 <span class="beta-badge">BETA</span>`;
    els.highPriorityButton.title = "운영시트의 중요도 '상' 기사만 노출";
  }
  if (els.backToTopButton) els.backToTopButton.textContent = "상단으로 가기";
}

function enableHoverFilters() {
  document.querySelectorAll(".filter-collapse").forEach((details) => {
    let closeTimer;
    details.addEventListener("mouseenter", () => {
      clearTimeout(closeTimer);
      details.open = true;
    });
    details.addEventListener("mouseleave", () => {
      closeTimer = setTimeout(() => {
        details.open = false;
      }, 120);
    });
  });
}

function bindEvents() {
  const debouncedApplyFilters = debounce(applyFilters, 300);

  [els.keywordInput, els.startDate, els.endDate, els.sortSelect].forEach((element) => {
    if (element) element.addEventListener("input", debouncedApplyFilters);
  });

  [els.countryFilter, els.sectorFilter, els.infoClassFilter].forEach((element) => {
    if (element) element.addEventListener("change", debouncedApplyFilters);
  });

  if (els.regionFilter) {
    els.regionFilter.addEventListener("change", () => {
      updateCountryOptions();
      applyFilters();
    });
  }

  els.datePresetButtons?.forEach((button) => {
    button.addEventListener("click", () => {
      const allPeriod = button.dataset.period === "all";
      if (allPeriod) {
        setAllDateRange();
      } else {
        setRelativeDateRange(Number(button.dataset.days || CONFIG.DEFAULT_PERIOD_DAYS), true);
      }
    });
  });

  if (els.resetButton) {
    els.resetButton.addEventListener("click", () => {
      if (els.keywordInput) els.keywordInput.value = "";
      clearCheckedValues(els.regionFilter);
      clearCheckedValues(els.countryFilter);
      clearCheckedValues(els.sectorFilter);
      clearCheckedValues(els.infoClassFilter);
      if (els.sortSelect) els.sortSelect.value = "중요도:desc";
      state.highPriorityOnly = false;
      syncHighPriorityButton();
      setDefaultDates(true);
      state.expanded.clear();
      updateCountryOptions();
      applyFilters();
      saveFilterState();
    });
  }

  document.querySelectorAll("[data-reset-filter]").forEach((button) => {
    button.addEventListener("click", () => els.resetButton?.click());
  });

  if (els.refreshButton) els.refreshButton.addEventListener("click", refreshData);
  if (els.exportButton) els.exportButton.addEventListener("click", exportToCSV);
  if (els.highPriorityButton) {
    els.highPriorityButton.addEventListener("click", () => {
      state.highPriorityOnly = !state.highPriorityOnly;
      state.expanded.clear();
      syncHighPriorityButton();
      applyFilters();
    });
  }
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

async function refreshData() {
  try {
    if (els.refreshButton) els.refreshButton.disabled = true;
    if (els.syncStatus) els.syncStatus.textContent = "캐시 데이터 새로 고침 중...";
    await loadData({ bustCache: true });
  } catch (error) {
    console.error("Refresh error:", error);
    if (els.syncStatus) els.syncStatus.textContent = "새로 고침 실패 - 캐시 생성 상태를 확인해주세요";
  } finally {
    if (els.refreshButton) els.refreshButton.disabled = false;
  }
}

async function loadData({ bustCache = false } = {}) {
  try {
    const [rows, meta] = await Promise.all([
      fetchRowsWithSheetFallback(CONFIG.DATA_URL, CONFIG.RESULT_GID, CONFIG.RESULT_RANGE, bustCache),
      fetchJson(CONFIG.META_URL, bustCache).catch(() => null),
    ]);
    const dataRows = Array.isArray(rows) ? rows : rows?.articles || [];
    if (!dataRows.length) throw new Error("No cached article data returned");

    state.cacheMeta = meta;
    state.rows = normalizeRows(dataRows);
    state.expanded.clear();
    populateFilters();
    applyFilters();
    updateSyncStatus();
  } catch (error) {
    console.error("Data fetch error:", error);
    showError();
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
  const source = updatedAt ? formatDateTime(new Date(updatedAt)) : formatDateTime(new Date());
  els.syncStatus.textContent = `캐시 기준 ${source}`;
}

function saveFilterState() {
  const filterState = {
    keyword: els.keywordInput?.value || "",
    startDate: els.startDate?.value || "",
    endDate: els.endDate?.value || "",
    region: getCheckedValues(els.regionFilter),
    country: getCheckedValues(els.countryFilter),
    sector: getCheckedValues(els.sectorFilter),
    infoClass: getCheckedValues(els.infoClassFilter),
    sort: els.sortSelect?.value || "중요도:desc",
    highPriorityOnly: state.highPriorityOnly,
  };
  try {
    localStorage.setItem("dashboardFilters", JSON.stringify(filterState));
  } catch (e) {
    console.warn("Failed to save filter state:", e);
  }
}

function loadFilterState() {
  try {
    const saved = localStorage.getItem("dashboardFilters");
    if (saved) {
      const filterState = JSON.parse(saved);
      savedFilterState = filterState;
      if (els.keywordInput) els.keywordInput.value = filterState.keyword || "";
      if (els.startDate) els.startDate.value = filterState.startDate || "";
      if (els.endDate) els.endDate.value = filterState.endDate || "";
      if (els.sortSelect) els.sortSelect.value = filterState.sort || "중요도:desc";
      state.highPriorityOnly = Boolean(filterState.highPriorityOnly);
    } else if (els.sortSelect) {
      els.sortSelect.value = "중요도:desc";
    }
  } catch (e) {
    console.warn("Failed to load filter state:", e);
    if (els.sortSelect) els.sortSelect.value = "중요도:desc";
  }
}

function setDefaultDates(force = false) {
  if (force || !els.startDate?.value || !els.endDate?.value) {
    setRelativeDateRange(CONFIG.DEFAULT_PERIOD_DAYS, false);
  }
}

function setRelativeDateRange(days, shouldApply = true) {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - days + 1);
  if (els.startDate) els.startDate.value = toDateInputValue(start);
  if (els.endDate) els.endDate.value = toDateInputValue(today);
  syncDatePresetButtons(days);
  if (shouldApply) {
    state.expanded.clear();
    applyFilters();
  }
}

function setAllDateRange() {
  const dates = state.rows.map((row) => row._publishedDate).filter(Boolean).sort((a, b) => a.getTime() - b.getTime());
  if (els.startDate) els.startDate.value = dates[0] ? toDateInputValue(dates[0]) : "";
  if (els.endDate) els.endDate.value = toDateInputValue(new Date());
  syncDatePresetButtons("all");
  state.expanded.clear();
  applyFilters();
}

function syncDatePresetButtons(activeDays = null) {
  const days = activeDays || getCurrentPresetDays();
  els.datePresetButtons?.forEach((button) => {
    const isActive = button.dataset.period === "all" ? days === "all" : Number(button.dataset.days) === days;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function getCurrentPresetDays() {
  if (!els.startDate?.value || !els.endDate?.value) return null;
  const start = new Date(`${els.startDate.value}T00:00:00`);
  const end = new Date(`${els.endDate.value}T00:00:00`);
  const diff = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  return diff > 0 ? diff : null;
}

function normalizeRows(rows) {
  return rows
    .map((row, index) => {
      const normalized = { id: row["기사 고유값"] || String(index) };
      REQUIRED_COLUMNS.forEach((column) => {
        normalized[column] = cleanValue(row[column]);
      });
      normalized._publishedDate = parseSheetDate(normalized["원문게재일"]);
      normalized._collectedDate = parseSheetDate(normalized["기사수집일"]);
      normalized._importanceScore = getImportanceScore(normalized["중요도"]);
      return normalized;
    })
    .filter((row) => row["원문게재일"] || row["제목(한글)"] || row["제목(원문)"]);
}

function cleanValue(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function parseSheetDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
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

function populateFilters() {
  setCheckboxOptions(els.regionFilter, uniqueValues(state.rows, "지역"), getInitialSelection("region", els.regionFilter));
  setCheckboxOptions(els.sectorFilter, uniqueValues(state.rows, "섹터"), getInitialSelection("sector", els.sectorFilter));
  setCheckboxOptions(
    els.infoClassFilter,
    sortInfoClasses(uniqueValues(state.rows, "정보 분류")),
    getInitialSelection("infoClass", els.infoClassFilter),
    formatInfoClassFilterLabel,
  );
  updateCountryOptions();
  savedFilterState = null;
}

function updateCountryOptions() {
  const selectedRegions = getCheckedValues(els.regionFilter);
  const source = selectedRegions.length ? state.rows.filter((row) => selectedRegions.includes(row["지역"])) : state.rows;
  setCheckboxOptions(els.countryFilter, uniqueValues(source, "국가"), getInitialSelection("country", els.countryFilter));
}

function getInitialSelection(key, container) {
  const current = getCheckedValues(container);
  if (current.length) return current;
  return asArray(savedFilterState?.[key]);
}

function uniqueValues(rows, key) {
  return [...new Set(rows.map((row) => row[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
}

function sortInfoClasses(values) {
  return [...values].sort((a, b) => {
    const rank = getInfoClassRank(a) - getInfoClassRank(b);
    return rank || a.localeCompare(b, "ko");
  });
}

function getInfoClassRank(value) {
  const index = INFO_CLASS_ORDER.indexOf(value);
  return index === -1 ? 999 : index;
}

function formatInfoClassFilterLabel(value) {
  return INFO_CLASS_FILTER_LABELS[value] || value;
}

function setCheckboxOptions(container, values, selectedValues = [], labelFormatter = (value) => value) {
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
    text.textContent = labelFormatter(value);
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

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

function applyFilters() {
  const keyword = (els.keywordInput?.value || "").trim().toLowerCase();
  const start = els.startDate?.value ? new Date(`${els.startDate.value}T00:00:00`) : null;
  const end = els.endDate?.value ? new Date(`${els.endDate.value}T23:59:59`) : null;
  const regions = getCheckedValues(els.regionFilter);
  const countries = getCheckedValues(els.countryFilter);
  const sectors = getCheckedValues(els.sectorFilter);
  const infoClasses = getCheckedValues(els.infoClassFilter);

  let rows = state.rows.filter((row) => {
    const date = row._publishedDate;
    const dateOk = (!start || (date && date >= start)) && (!end || (date && date <= end));
    const regionOk = !regions.length || regions.includes(row["지역"]);
    const countryOk = !countries.length || countries.includes(row["국가"]);
    const sectorOk = !sectors.length || sectors.includes(row["섹터"]);
    const infoClassOk = !infoClasses.length || infoClasses.includes(row["정보 분류"]);
    const priorityOk = !state.highPriorityOnly || isHighPriorityArticle(row);
    const keywordOk =
      !keyword ||
      ["제목(한글)", "제목(원문)", "내용", "국가", "지역", "섹터", "주제", "정보 분류", "프로젝트명"].some((key) =>
        row[key].toLowerCase().includes(keyword),
      ) ||
      formatInfoClassFilterLabel(row["정보 분류"]).toLowerCase().includes(keyword);
    return dateOk && regionOk && countryOk && sectorOk && infoClassOk && priorityOk && keywordOk;
  });

  rows = sortRows(rows, els.sortSelect?.value || "중요도:desc");
  state.filteredRows = rows;
  state.expanded.forEach((id) => {
    if (!rows.some((row) => row.id === id)) state.expanded.delete(id);
  });
  updateSummary();
  renderTopNewsCards();
  renderRows();
  updateActiveFilterText();
  syncDatePresetButtons();
  saveFilterState();
}

window.applyFilters = applyFilters;

function isHighPriorityArticle(row) {
  return cleanValue(row["중요도"]) === "상" || getImportanceScore(row["중요도"]) >= 80;
}

function syncHighPriorityButton() {
  if (!els.highPriorityButton) return;
  els.highPriorityButton.classList.toggle("is-active", state.highPriorityOnly);
  els.highPriorityButton.setAttribute("aria-pressed", String(state.highPriorityOnly));
}

function getImportanceScore(value) {
  const text = cleanValue(value);
  if (!text) return -1;
  const numberMatch = text.match(/-?\d+(?:\.\d+)?/);
  if (numberMatch) return Number(numberMatch[0]);
  if (/상|높|high|중요|우선/.test(text.toLowerCase())) return 90;
  if (/중|보통|medium/.test(text.toLowerCase())) return 50;
  if (/하|낮|low/.test(text.toLowerCase())) return 10;
  return -1;
}

function sortRows(rows, sortValue) {
  const [key, direction] = sortValue.split(":");
  const multiplier = direction === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    if (key === "interest") {
      const countDiff = (getSheetInterestCount(a) - getSheetInterestCount(b)) * multiplier;
      if (countDiff) return countDiff;
      return (b._publishedDate?.getTime() || 0) - (a._publishedDate?.getTime() || 0);
    }
    if (key === "중요도") {
      const scoreDiff = (getImportanceScore(a["중요도"]) - getImportanceScore(b["중요도"])) * multiplier;
      if (scoreDiff) return scoreDiff;
      return (b._publishedDate?.getTime() || 0) - (a._publishedDate?.getTime() || 0);
    }
    if (key.includes("일")) {
      const timeA = (key === "원문게재일" ? a._publishedDate : a._collectedDate)?.getTime() || 0;
      const timeB = (key === "원문게재일" ? b._publishedDate : b._collectedDate)?.getTime() || 0;
      return (timeA - timeB) * multiplier;
    }
    if (key === "정보 분류") {
      const rank = getInfoClassRank(a[key]) - getInfoClassRank(b[key]);
      return (rank || a[key].localeCompare(b[key], "ko")) * multiplier;
    }
    return a[key].localeCompare(b[key], "ko") * multiplier;
  });
}

function updateSummary() {
  const latest = state.rows.map((row) => row._publishedDate).filter(Boolean).sort((a, b) => b.getTime() - a.getTime())[0];
  if (els.totalCount) els.totalCount.textContent = numberFormat(state.rows.length);
  if (els.filteredCount) els.filteredCount.textContent = numberFormat(state.filteredRows.length);
  if (els.countryCount) els.countryCount.textContent = numberFormat(uniqueValues(state.rows, "국가").length);
  if (els.sectorCount) els.sectorCount.textContent = numberFormat(uniqueValues(state.rows, "섹터").length);
  if (els.latestDate) els.latestDate.textContent = latest ? formatDate(latest) : "-";
  if (els.resultCountLabel) {
    const shownCount = Math.min(state.filteredRows.length, CONFIG.DISPLAY_LIMIT);
    els.resultCountLabel.textContent =
      state.filteredRows.length > CONFIG.DISPLAY_LIMIT
        ? `${numberFormat(shownCount)}건 표시 / 전체 ${numberFormat(state.filteredRows.length)}건`
        : `${numberFormat(state.filteredRows.length)}건`;
  }
}

function renderTopNewsCards() {
  if (!els.topNewsSection || !els.topNewsCards) return;
  const topRows = sortRows(state.filteredRows, "중요도:desc")
    .filter((row) => getImportanceScore(row["중요도"]) >= 0)
    .slice(0, CONFIG.TOP_NEWS_LIMIT);
  els.topNewsSection.hidden = topRows.length === 0;
  els.topNewsCards.innerHTML = "";
  topRows.forEach((row, index) => els.topNewsCards.appendChild(createTopNewsCard(row, index + 1)));
}

function createTopNewsCard(row, rank) {
  const article = document.createElement("article");
  article.className = "top-news-card";
  const title = row["제목(한글)"] || row["제목(원문)"] || "제목 없음";
  const score = getImportanceScore(row["중요도"]);
  const importanceLabel = score >= 0 ? row["중요도"] || score : "-";
  const titleMarkup = row["출처링크"]
    ? `<a href="${escapeAttribute(row["출처링크"])}" target="_blank" rel="noreferrer">${escapeHtml(title)}</a>`
    : `<span>${escapeHtml(title)}</span>`;
  article.innerHTML = `
    <div class="top-news-meta">
      <span class="top-news-rank">TOP ${rank}</span>
      <span>${escapeHtml(row["국가"] || "-")}</span>
      <span>${escapeHtml(row["섹터"] || "-")}</span>
    </div>
    <h3>${titleMarkup}</h3>
    <p>${escapeHtml(row["주제"] || row["정보 분류"] || "핵심 키워드 없음")}</p>
    <div class="top-news-foot">
      <span>중요도 ${escapeHtml(importanceLabel)}</span>
      <span>${escapeHtml(formatDate(row._publishedDate) || row["원문게재일"] || "-")}</span>
    </div>`;
  return article;
}

function renderRows() {
  if (els.loadingState) els.loadingState.hidden = true;
  if (els.errorState) els.errorState.hidden = true;
  if (els.emptyState) els.emptyState.hidden = state.filteredRows.length > 0;
  if (els.tableWrap) els.tableWrap.hidden = state.filteredRows.length === 0;
  if (els.limitNotice) els.limitNotice.hidden = state.filteredRows.length <= CONFIG.DISPLAY_LIMIT;
  if (els.resultBody) els.resultBody.innerHTML = "";
  const fragment = document.createDocumentFragment();
  state.filteredRows.slice(0, CONFIG.DISPLAY_LIMIT).forEach((row) => {
    const isExpanded = state.expanded.has(row.id);
    fragment.appendChild(createMainRow(row, isExpanded));
    if (isExpanded) fragment.appendChild(createDetailRow(row));
  });
  if (els.resultBody) els.resultBody.appendChild(fragment);
}

function createMainRow(row, isExpanded) {
  const tr = document.createElement("tr");
  tr.dataset.rowId = row.id;
  tr.dataset.articleId = row["기사 고유값"] || row.id;
  tr.dataset.sheetInterestCount = String(getSheetInterestCount(row));
  tr.innerHTML = `
    <td class="market-title-cell" data-label="제목">${renderTitleLink(row)}</td>
    <td data-label="핵심 키워드"><span class="keyword-pill">${escapeHtml(row["주제"] || "-")}</span></td>
    <td data-label="국가"><span class="country-name">${escapeHtml(row["국가"] || "-")}</span>${row["지역"] ? `<span class="market-region">${escapeHtml(row["지역"])}</span>` : ""}</td>
    <td data-label="섹터">${escapeHtml(row["섹터"] || "-")}</td>
    <td data-label="정보 분류"><span class="pill info-pill">${escapeHtml(row["정보 분류"] || "-")}</span></td>
    <td class="date-cell" data-label="원문게재일">${escapeHtml(formatDate(row._publishedDate) || row["원문게재일"])}</td>
    <td data-label="상세"><button class="detail-button" type="button" aria-expanded="${isExpanded}" aria-label="상세 보기">${isExpanded ? "−" : "+"}</button></td>`;
  tr.addEventListener("click", (event) => {
    if (event.target.closest("a") || event.target.closest("button")) return;
    toggleDetail(row.id);
  });
  tr.querySelector(".detail-button").addEventListener("click", () => toggleDetail(row.id));
  return tr;
}

function createDetailRow(row) {
  const tr = document.createElement("tr");
  tr.className = "detail-row";
  tr.dataset.detailFor = row.id;
  tr.innerHTML = `
    <td colspan="7">
      <div class="detail-panel">
        <div>
          <h3>${escapeHtml(row["제목(원문)"] || row["제목(한글)"] || "원문 제목 없음")}</h3>
          ${renderProjectBlock(row)}
          <p>${escapeHtml(row["내용"] || "내용 요약이 없습니다.")}</p>
        </div>
        <div class="detail-meta">
          ${row["주제"] ? `<span><strong>핵심 키워드</strong> ${escapeHtml(row["주제"])}</span>` : ""}
          ${row["정보 분류"] ? `<span><strong>정보 분류</strong> ${escapeHtml(row["정보 분류"])}</span>` : ""}
          ${row["중요도"] ? `<span><strong>중요도</strong> ${escapeHtml(row["중요도"])}</span>` : ""}
          ${row["관련 단계"] ? `<span><strong>관련 단계</strong> ${escapeHtml(row["관련 단계"])}</span>` : ""}
          <span><strong>기사수집일</strong> ${escapeHtml(formatDate(row._collectedDate) || row["기사수집일"] || "-")}</span>
          <span><strong>출처언어</strong> ${escapeHtml(row["출처언어"] || "-")}</span>
          ${row["출처링크"] ? `<a href="${escapeAttribute(row["출처링크"])}" target="_blank" rel="noreferrer">원문 링크 열기</a>` : "<span>원문 링크 없음</span>"}
        </div>
      </div>
    </td>`;
  return tr;
}

function renderProjectBlock(row) {
  if (!row["프로젝트명"]) return "";
  return `
    <div class="project-callout">
      <div>
        <strong>프로젝트명</strong>
        <span>${escapeHtml(row["프로젝트명"])}</span>
      </div>
      <a class="project-detail-link" href="${escapeAttribute(buildProjectDetailUrl(row))}">프로젝트 상세페이지</a>
    </div>`;
}

function buildProjectDetailUrl(row) {
  const params = new URLSearchParams();
  if (row["프로젝트 고유값"]) params.set("id", row["프로젝트 고유값"]);
  if (row["프로젝트명"]) params.set("name", row["프로젝트명"]);
  if (row["국가"]) params.set("country", row["국가"]);
  if (row["섹터"]) params.set("sector", row["섹터"]);
  return `./project.html?${params.toString()}`;
}

function renderTitleLink(row) {
  const title = row["제목(한글)"] || row["제목(원문)"] || "제목 없음";
  if (!row["출처링크"]) return `<span class="title-link">${escapeHtml(title)}</span>`;
  return `<a class="title-link" href="${escapeAttribute(row["출처링크"])}" target="_blank" rel="noreferrer">${escapeHtml(title)}</a>`;
}

function toggleDetail(id) {
  if (!els.resultBody) return;

  const currentDetail = els.resultBody.querySelector("tr.detail-row");
  const currentMain = currentDetail ? getPreviousMainRow(currentDetail) : null;
  const currentId = currentDetail?.dataset.detailFor || currentMain?.dataset.rowId || "";

  if (currentDetail) currentDetail.remove();
  if (currentMain) setRowExpanded(currentMain, false);

  if (state.expanded.has(id)) {
    state.expanded.delete(id);
    return;
  }

  state.expanded.clear();
  const mainRow = els.resultBody.querySelector(`tr[data-row-id="${cssEscape(id)}"]`);
  const row = state.filteredRows.find((item) => item.id === id);

  if (!mainRow || !row) {
    state.expanded.add(id);
    renderRows();
    return;
  }

  if (currentId !== id) {
    state.expanded.add(id);
    setRowExpanded(mainRow, true);
    const detailRow = createDetailRow(row);
    const detailCell = detailRow.querySelector("td");
    if (detailCell) detailCell.colSpan = mainRow.children.length;
    mainRow.insertAdjacentElement("afterend", detailRow);
    window.InterestFeature?.enhanceDetailRow?.(detailRow, row);
  }
}

function setRowExpanded(row, expanded) {
  const button = row?.querySelector(".detail-button");
  if (!button) return;
  button.setAttribute("aria-expanded", String(expanded));
  button.textContent = expanded ? "−" : "+";
}

function getPreviousMainRow(row) {
  let current = row.previousElementSibling;
  while (current && current.classList.contains("detail-row")) current = current.previousElementSibling;
  return current;
}

function getSheetInterestCount(row) {
  for (const column of INTEREST_COUNT_COLUMNS) {
    const value = Number(String(row?.[column] || "").replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

function cssEscape(value) {
  if (window.CSS?.escape) return CSS.escape(value);
  return String(value).replace(/["\\]/g, "\\$&");
}

function updateActiveFilterText() {
  const filters = [];
  const presetDays = getCurrentPresetDays();
  const presetLabel = getPresetLabel(presetDays);
  if (presetLabel) {
    filters.push(presetLabel);
  } else if (els.startDate?.value || els.endDate?.value) {
    filters.push(`${els.startDate?.value || "전체"} ~ ${els.endDate?.value || "전체"}`);
  }
  if (els.keywordInput?.value?.trim()) filters.push(`검색: ${els.keywordInput.value.trim()}`);
  pushSelectedFilter(filters, "지역", getCheckedValues(els.regionFilter));
  pushSelectedFilter(filters, "국가", getCheckedValues(els.countryFilter));
  pushSelectedFilter(filters, "섹터", getCheckedValues(els.sectorFilter));
  pushSelectedFilter(filters, "정보 분류", getCheckedValues(els.infoClassFilter).map(formatInfoClassFilterLabel));
  if (state.highPriorityOnly) filters.push("중요도: 상");
  if (els.activeFilterText) els.activeFilterText.textContent = filters.length ? filters.join(" · ") : "전체 기간";
}

function getPresetLabel(days) {
  if (days === 7) return "최근 1주일";
  if (days === 30) return "최근 1개월";
  if (days === 90) return "최근 3개월";
  if (days === 365) return "최근 1년";
  return "";
}

function pushSelectedFilter(filters, label, values) {
  if (!values.length) return;
  const suffix = values.length > 1 ? ` 외 ${values.length - 1}` : "";
  filters.push(`${label}: ${values[0]}${suffix}`);
}

function showError() {
  if (els.loadingState) els.loadingState.hidden = true;
  if (els.errorState) {
    els.errorState.hidden = false;
    els.errorState.textContent = "캐시 데이터를 불러오지 못했습니다. GitHub Actions의 시트 동기화 실행 상태를 확인해주세요.";
  }
  if (els.emptyState) els.emptyState.hidden = true;
  if (els.tableWrap) els.tableWrap.hidden = true;
  if (els.topNewsSection) els.topNewsSection.hidden = true;
  if (els.limitNotice) els.limitNotice.hidden = true;
  if (els.syncStatus) els.syncStatus.textContent = "캐시 데이터 연결 실패";
}

function exportToCSV() {
  if (state.filteredRows.length === 0) {
    alert("다운로드할 데이터가 없습니다.");
    return;
  }
  try {
    els.exportButton.disabled = true;
    els.exportButton.textContent = "다운로드 중...";
    const headers = EXPORT_COLUMNS;
    const csvContent = [
      headers.map((h) => `"${h}"`).join(","),
      ...state.filteredRows.map((row) => headers.map((col) => `"${String(row[col] || "").replace(/"/g, '""')}"`).join(",")),
    ].join("\r\n");
    const blob = new Blob(["\ufeff", csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `market-monitoring-list-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (error) {
    console.error("Export failed:", error);
    alert("목록 다운로드 중 오류가 발생했습니다.");
  } finally {
    els.exportButton.disabled = false;
    els.exportButton.textContent = "📥 목록 다운로드";
  }
}

function formatDate(date) {
  if (!date || Number.isNaN(date.getTime())) return "";
  return toDateInputValue(date);
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

function toDateInputValue(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function numberFormat(value) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('\"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
