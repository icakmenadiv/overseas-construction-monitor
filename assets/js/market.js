/* inline script from production HTML */

(() => {
        try {
          const versionKey = "marketFilterSchemaVersion";
          const currentVersion = "20260625-date-sort-fix-1";
          const saved = JSON.parse(localStorage.getItem("dashboardFilters") || "{}");
          saved.sort = saved.sort || "중요도:desc";
          saved.highPriorityOnly = false;
          localStorage.setItem("dashboardFilters", JSON.stringify(saved));
          localStorage.setItem(versionKey, currentVersion);
        } catch (error) {
          console.warn("Failed to migrate market filter defaults:", error);
        }
      })();

;

/* =========================================================
   source: app.js
   ========================================================= */

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

;

/* =========================================================
   source: market-date-sort-fix.js
   ========================================================= */

(() => {
  const DAY_MS = 86400000;
  const PRESET_LENGTHS = new Set([7, 30, 90, 365]);

  window.parseSheetDate = function parseSheetDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === "number" && Number.isFinite(value)) {
      return value > 20000 ? new Date(Math.round((value - 25569) * DAY_MS)) : null;
    }

    const text = String(value).trim();
    const dateCtorMatch = text.match(/^Date\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (dateCtorMatch) {
      return new Date(Number(dateCtorMatch[1]), Number(dateCtorMatch[2]), Number(dateCtorMatch[3]));
    }

    const sheetDateMatch = text.match(/(\d{4})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{1,2})/);
    if (sheetDateMatch) {
      return new Date(Number(sheetDateMatch[1]), Number(sheetDateMatch[2]) - 1, Number(sheetDateMatch[3]));
    }

    const koreanDateMatch = text.match(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
    if (koreanDateMatch) {
      return new Date(Number(koreanDateMatch[1]), Number(koreanDateMatch[2]) - 1, Number(koreanDateMatch[3]));
    }

    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  refreshSavedPresetDateRange();

  function refreshSavedPresetDateRange() {
    try {
      const saved = JSON.parse(localStorage.getItem("dashboardFilters") || "{}");
      if (!saved.startDate || !saved.endDate) return;

      const start = parseInputDate(saved.startDate);
      const end = parseInputDate(saved.endDate);
      const today = startOfToday();
      if (!start || !end || end >= today) return;

      const spanDays = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
      if (!PRESET_LENGTHS.has(spanDays)) return;

      const nextStart = new Date(today);
      nextStart.setDate(today.getDate() - spanDays + 1);
      saved.startDate = toDateInputValue(nextStart);
      saved.endDate = toDateInputValue(today);
      localStorage.setItem("dashboardFilters", JSON.stringify(saved));
    } catch (error) {
      console.warn("Failed to refresh saved market date preset:", error);
    }
  }

  function parseInputDate(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  function startOfToday() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function toDateInputValue(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
})();

;

/* =========================================================
   source: interest-sort.js
   ========================================================= */

(() => {
  const HEART_COLUMNS = ["관심도", "관심도 집계", "관심수", "하트수", "관심도 수치"];
  const VIEW_COLUMNS = ["조회수", "조회 수", "viewCount", "views"];
  const HEART_WEIGHT = 5;

  window.normalizeRows = function normalizeRowsWithTrackingColumns(rows) {
    return rows
      .map((row, index) => {
        const normalized = { id: cleanValue(row?.["기사 고유값"] || String(index)) };
        Object.entries(row || {}).forEach(([key, value]) => {
          normalized[cleanValue(key)] = cleanValue(value);
        });
        normalized.id = normalized["기사 고유값"] || normalized.id || String(index);
        normalized._publishedDate = window.parseSheetDate?.(normalized["원문게재일"]) || parseSheetDateFallback(normalized["원문게재일"]);
        normalized._collectedDate = window.parseSheetDate?.(normalized["기사수집일"]) || parseSheetDateFallback(normalized["기사수집일"]);
        normalized._importanceScore = getImportanceScore(normalized["중요도"]);
        normalized._heartCount = getFirstPositiveNumber(normalized, HEART_COLUMNS);
        normalized._viewCount = getFirstPositiveNumber(normalized, VIEW_COLUMNS);
        normalized._interestScore = normalized._heartCount * HEART_WEIGHT + normalized._viewCount;
        return normalized;
      })
      .filter((row) => row["원문게재일"] || row["제목(한글)"] || row["제목(원문)"]);
  };

  window.sortRows = function sortRowsWithWeightedInterest(rows, sortValue) {
    const [key, direction] = String(sortValue || "중요도:desc").split(":");
    const multiplier = direction === "desc" ? -1 : 1;

    return [...rows].sort((a, b) => {
      if (key === "interest") {
        return (
          compareNumber(a._interestScore, b._interestScore, multiplier) ||
          compareNumber(a._heartCount, b._heartCount, multiplier) ||
          compareNumber(a._viewCount, b._viewCount, multiplier) ||
          compareNumber(getImportanceScore(a["중요도"]), getImportanceScore(b["중요도"]), multiplier) ||
          compareDateDesc(a._publishedDate, b._publishedDate) ||
          compareText(a["제목(한글)"] || a["제목(원문)"], b["제목(한글)"] || b["제목(원문)"])
        );
      }

      if (key === "중요도") {
        return (
          compareNumber(getImportanceScore(a["중요도"]), getImportanceScore(b["중요도"]), multiplier) ||
          compareDateDesc(a._publishedDate, b._publishedDate)
        );
      }

      if (key.includes("일")) {
        const timeA = (key === "원문게재일" ? a._publishedDate : a._collectedDate)?.getTime() || 0;
        const timeB = (key === "원문게재일" ? b._publishedDate : b._collectedDate)?.getTime() || 0;
        return (timeA - timeB) * multiplier;
      }

      if (key === "정보 분류") {
        const rank = getInfoClassRank(key, a[key]) - getInfoClassRank(key, b[key]);
        return (rank || compareText(a[key], b[key])) * multiplier;
      }

      return compareText(a[key], b[key]) * multiplier;
    });
  };

  window.getWeightedInterestScore = function getWeightedInterestScore(row) {
    const hearts = getFirstPositiveNumber(row, HEART_COLUMNS);
    const views = getFirstPositiveNumber(row, VIEW_COLUMNS);
    return hearts * HEART_WEIGHT + views;
  };

  function compareNumber(a, b, multiplier) {
    const diff = (Number(a || 0) - Number(b || 0)) * multiplier;
    return diff || 0;
  }

  function compareDateDesc(a, b) {
    return (b?.getTime?.() || 0) - (a?.getTime?.() || 0);
  }

  function compareText(a, b) {
    return cleanValue(a).localeCompare(cleanValue(b), "ko");
  }

  function getFirstPositiveNumber(row, columns) {
    for (const column of columns) {
      const value = parseNumber(row?.[column]);
      if (value > 0) return value;
    }
    return 0;
  }

  function getImportanceScore(value) {
    if (typeof window.getImportanceScore === "function") return window.getImportanceScore(value);
    const text = cleanValue(value);
    if (!text) return -1;
    const numberMatch = text.match(/-?\d+(?:\.\d+)?/);
    if (numberMatch) return Number(numberMatch[0]);
    if (/상|높|high|중요|우선/.test(text.toLowerCase())) return 90;
    if (/중|보통|medium/.test(text.toLowerCase())) return 50;
    if (/하|낮|low/.test(text.toLowerCase())) return 10;
    return -1;
  }

  function getInfoClassRank(key, value) {
    if (typeof window.getInfoClassRank === "function") return window.getInfoClassRank(value);
    return 999;
  }

  function parseNumber(value) {
    const match = cleanValue(value).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : 0;
  }

  function parseSheetDateFallback(value) {
    const text = cleanValue(value).replace(/^'+/, "").trim();
    const match = text.match(/(\d{4})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{1,2})/);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function cleanValue(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }
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
   source: interest.js
   ========================================================= */

(() => {
  const STORAGE_KEYS = {
    localVotes: "icakInterestLocalVotes",
    localDeltas: "icakInterestLocalDeltas",
  };
  const COUNT_COLUMNS = ["관심도", "관심도 집계", "관심수", "하트수", "관심도 수치"];
  const PROJECT_ENHANCE_DELAYS = [0, 120, 360, 900, 1800, 3200];
  let projectObserverReady = false;

  window.InterestFeature = {
    enabled: true,
    enhanceDetailRow,
    hydrate: hydrateButtons,
  };

  wrapMarketRenderers();
  wrapTopNewsRenderer();
  wrapProjectRenderer();
  document.addEventListener("DOMContentLoaded", () => {
    wrapMarketRenderers();
    wrapTopNewsRenderer();
    wrapProjectRenderer();
    watchProjectPage();
    scheduleProjectEnhance();
    hydrateButtons();
  });
  if (document.readyState !== "loading") {
    watchProjectPage();
    scheduleProjectEnhance();
  }

  function wrapMarketRenderers() {
    if (window.__interestMarketWrapped || typeof window.createMainRow !== "function") return;
    window.__interestMarketWrapped = true;
    const originalCreateMainRow = window.createMainRow;
    window.createMainRow = function createMainRowWithInterest(row, isExpanded) {
      const tr = originalCreateMainRow.call(this, row, isExpanded);
      return enhanceMarketRow(tr, row);
    };
  }

  function wrapTopNewsRenderer() {
    if (window.__interestTopNewsWrapped || typeof window.createTopNewsCard !== "function") return;
    window.__interestTopNewsWrapped = true;
    const originalCreateTopNewsCard = window.createTopNewsCard;
    window.createTopNewsCard = function createTopNewsCardWithInterest(row, rank) {
      const card = originalCreateTopNewsCard.call(this, row, rank);
      const story = storyFromArticleRow(row);
      if (!story.id) return card;
      card.dataset.articleId = story.id;
      card.dataset.sheetInterestCount = String(story.sheetCount);
      const wrap = document.createElement("div");
      wrap.className = "top-news-interest";
      wrap.appendChild(createInterestButton(story, "top-news"));
      card.appendChild(wrap);
      return card;
    };
  }

  function wrapProjectRenderer() {
    if (window.__interestProjectWrapped || typeof window.renderProject !== "function") return;
    window.__interestProjectWrapped = true;
    const originalRenderProject = window.renderProject;
    window.renderProject = function renderProjectWithInterest(project, articleItems) {
      const result = originalRenderProject.call(this, project, articleItems);
      scheduleProjectEnhance();
      return result;
    };
  }

  function watchProjectPage() {
    if (projectObserverReady) return;
    const content = document.getElementById("projectContent");
    if (!content) return;
    projectObserverReady = true;
    const observer = new MutationObserver(() => scheduleProjectEnhance());
    observer.observe(content, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
  }

  function scheduleProjectEnhance() {
    PROJECT_ENHANCE_DELAYS.forEach((delay) => setTimeout(() => {
      enhanceExistingProjectPage();
      hydrateButtons();
    }, delay));
  }

  function enhanceMarketRow(row, rowData) {
    if (!row || row.classList.contains("detail-row")) return row;
    const detailCell = [...row.children].find((cell) => cell.querySelector(".detail-button") || clean(cell.dataset.label) === "상세");
    const story = storyFromArticleRow(rowData);
    if (!story.id) return row;
    const cell = detailCell || document.createElement("td");
    cell.className = "interest-cell";
    cell.dataset.label = "관심";
    cell.replaceChildren(createInterestButton(story, "article"));
    if (!detailCell) row.appendChild(cell);
    row.dataset.articleId = story.id;
    row.dataset.sheetInterestCount = String(story.sheetCount);
    return row;
  }

  function enhanceDetailRow(detailRow, rowData) {
    const story = storyFromArticleRow(rowData);
    const panel = detailRow?.querySelector(".detail-panel > div:first-child");
    if (!story.id || !panel || panel.querySelector(".interest-detail-box")) return;
    const box = document.createElement("div");
    box.className = "interest-detail-box";
    box.innerHTML = "<strong>활용 가치가 높은 경우나 후속기사 추적을 원하는 경우 표시</strong>";
    box.appendChild(createInterestButton(story, "detail"));
    panel.appendChild(box);
    hydrateButtons(story.id);
  }

  function enhanceExistingProjectPage() {
    const content = document.getElementById("projectContent");
    if (!content || content.hidden) return;
    ensureProjectInterestBox();
    document.querySelectorAll("#projectArticles .project-article-card").forEach((card) => {
      if (card.dataset.interestReady === "true") return;
      const story = storyFromProjectArticleCard(card);
      if (!story.id) return;
      const meta = card.querySelector(".project-article-meta") || card;
      const wrap = document.createElement("span");
      wrap.className = "project-article-interest";
      wrap.dataset.projectLinkedInterest = "true";
      wrap.dataset.articleId = story.id;
      wrap.appendChild(createInterestButton(story, "project-article"));
      meta.appendChild(wrap);
      card.dataset.interestReady = "true";
    });
    refreshProjectAggregate();
  }

  function ensureProjectInterestBox() {
    const toolbar = document.querySelector(".project-toolbar");
    if (!toolbar || toolbar.querySelector(".project-interest-box")) return;
    const projectStory = storyFromProjectPage();
    const box = document.createElement("div");
    box.className = "project-interest-box";
    box.innerHTML = `
      <span class="project-interest-label">프로젝트 관심 표시</span>
      <strong class="project-interest-total" data-project-total-count>0</strong>
      <span class="project-interest-caption">관심 표시 수는 관련 기사 관심도와 이 화면의 프로젝트 표시를 함께 보는 참고 신호입니다.</span>`;
    box.insertBefore(createInterestButton(projectStory, "project"), box.querySelector(".project-interest-caption"));
    toolbar.appendChild(box);
  }

  function createInterestButton(story, role) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "interest-button";
    button.dataset.interestRole = role;
    button.dataset.articleId = story.id;
    button.dataset.sheetCount = String(story.sheetCount || 0);
    button.setAttribute("aria-label", "활용 가치가 높은 경우나 후속기사 추적을 원하는 경우 표시");
    button.innerHTML = '<span class="interest-heart" aria-hidden="true">♡</span><span class="interest-count">0</span>';
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleInterest(story.id, Number(button.dataset.sheetCount || 0));
    });
    syncButton(button);
    return button;
  }

  function toggleInterest(articleId, sheetCount) {
    const votes = readJson(STORAGE_KEYS.localVotes, {});
    const deltas = readJson(STORAGE_KEYS.localDeltas, {});
    const active = !votes[articleId];
    if (active) {
      votes[articleId] = true;
      deltas[articleId] = Number(deltas[articleId] || 0) + 1;
    } else {
      delete votes[articleId];
      deltas[articleId] = Number(deltas[articleId] || 0) - 1;
    }
    writeJson(STORAGE_KEYS.localVotes, votes);
    writeJson(STORAGE_KEYS.localDeltas, deltas);
    hydrateButtons(articleId, sheetCount);
  }

  function hydrateButtons(onlyArticleId = "", fallbackSheetCount = 0) {
    document.querySelectorAll(".interest-button").forEach((button) => {
      if (onlyArticleId && button.dataset.articleId !== onlyArticleId) return;
      if (fallbackSheetCount && !button.dataset.sheetCount) button.dataset.sheetCount = String(fallbackSheetCount);
      syncButton(button);
    });
    refreshProjectAggregate();
  }

  function syncButton(button) {
    const articleId = button.dataset.articleId;
    const active = Boolean(readJson(STORAGE_KEYS.localVotes, {})[articleId]);
    const sheetCount = Number(button.dataset.sheetCount || 0);
    const count = Math.max(0, sheetCount + Number(readJson(STORAGE_KEYS.localDeltas, {})[articleId] || 0));
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
    const heart = button.querySelector(".interest-heart");
    const countEl = button.querySelector(".interest-count");
    if (heart) heart.textContent = active ? "♥" : "♡";
    if (countEl) countEl.textContent = numberFormat(count);
  }

  function refreshProjectAggregate() {
    const totalEl = document.querySelector("[data-project-total-count]");
    if (!totalEl) return;
    const articleIds = [...new Set([...document.querySelectorAll("#projectArticles .project-article-interest")].map((node) => node.dataset.articleId).filter(Boolean))];
    const articleTotal = articleIds.reduce((sum, id) => {
      const button = document.querySelector(`.interest-button[data-article-id="${cssEscape(id)}"]`);
      const sheetCount = Number(button?.dataset.sheetCount || 0);
      return sum + Math.max(0, sheetCount + Number(readJson(STORAGE_KEYS.localDeltas, {})[id] || 0));
    }, 0);
    const projectId = storyFromProjectPage().id;
    const projectButton = document.querySelector(`.project-interest-box .interest-button[data-article-id="${cssEscape(projectId)}"]`);
    const projectTotal = projectButton ? Math.max(0, Number(projectButton.dataset.sheetCount || 0) + Number(readJson(STORAGE_KEYS.localDeltas, {})[projectId] || 0)) : 0;
    totalEl.textContent = numberFormat(articleTotal + projectTotal);
  }

  function storyFromArticleRow(row) {
    const id = clean(row?.["기사 고유값"]) || clean(row?.id);
    return { id, sheetCount: getSheetCount(row) };
  }

  function storyFromProjectArticleCard(card) {
    const id = clean(card.dataset.articleId);
    return { id, sheetCount: Number(card.dataset.sheetInterestCount || 0) };
  }

  function storyFromProjectPage() {
    const params = new URLSearchParams(window.location.search);
    const id = clean(params.get("id")) || clean(params.get("name")) || clean(document.getElementById("projectTitle")?.textContent) || "project-detail";
    return { id: `project:${id}`, sheetCount: 0 };
  }

  function getSheetCount(row) {
    for (const column of COUNT_COLUMNS) {
      const value = Number(String(row?.[column] || "").replace(/[^0-9.-]/g, ""));
      if (Number.isFinite(value) && value > 0) return value;
    }
    return 0;
  }

  function readJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn("Failed to write interest state:", error);
    }
  }

  function clean(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function numberFormat(value) {
    return new Intl.NumberFormat("ko-KR").format(Number(value || 0));
  }

  function cssEscape(value) {
    if (window.CSS?.escape) return CSS.escape(value);
    return String(value).replace(/["\\]/g, "\\$&");
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
