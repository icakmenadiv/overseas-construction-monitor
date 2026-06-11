const CONFIG = {
  SHEET_ID: "11WmfuDj7FSk5LRvEB2CArVETZOA9NgpySLYscG223-E",
  SHEET_GID: "748239675",
  SHEET_VIEW_URL:
    "https://docs.google.com/spreadsheets/d/11WmfuDj7FSk5LRvEB2CArVETZOA9NgpySLYscG223-E/edit?gid=748239675#gid=748239675",
  DEFAULT_PERIOD_DAYS: 30,
  DISPLAY_LIMIT: 200,
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

const state = {
  rows: [],
  filteredRows: [],
  expanded: new Set(),
};

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
  els.sheetLink.href = CONFIG.SHEET_VIEW_URL;
  els.footerSheetLink.href = CONFIG.SHEET_VIEW_URL;
  loadFilterState();
  bindEvents();
  setDefaultDates();

  try {
    const rows = await fetchSheetData();
    if (!rows || rows.length === 0) {
      throw new Error("No data returned from Google Sheets");
    }
    state.rows = normalizeRows(rows);
    populateFilters();
    applyFilters();
    els.syncStatus.textContent = `마지막 불러오기 ${formatDateTime(new Date())}`;
  } catch (error) {
    console.error("Data fetch error:", error);
    showError();
  }
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

  if (els.resetButton) {
    els.resetButton.addEventListener("click", () => {
      if (els.keywordInput) els.keywordInput.value = "";
      clearCheckedValues(els.regionFilter);
      clearCheckedValues(els.countryFilter);
      clearCheckedValues(els.sectorFilter);
      clearCheckedValues(els.infoClassFilter);
      if (els.sortSelect) els.sortSelect.value = "원문게재일:desc";
      setDefaultDates(true);
      updateCountryOptions();
      applyFilters();
      saveFilterState();
    });
  }

  if (els.refreshButton) {
    els.refreshButton.addEventListener("click", refreshData);
  }

  if (els.exportButton) {
    els.exportButton.addEventListener("click", exportToCSV);
  }

  if (els.backToTopButton) {
    els.backToTopButton.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
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
    els.refreshButton.disabled = true;
    els.syncStatus.textContent = "데이터 새로 고침 중...";
    const rows = await fetchSheetData();
    if (!rows || rows.length === 0) {
      throw new Error("No data returned");
    }
    state.rows = normalizeRows(rows);
    populateFilters();
    applyFilters();
    els.syncStatus.textContent = `마지막 불러오기 ${formatDateTime(new Date())}`;
  } catch (error) {
    console.error("Refresh error:", error);
    els.syncStatus.textContent = "새로 고침 실패 - 다시 시도해주세요";
  } finally {
    els.refreshButton.disabled = false;
  }
}

async function fetchSheetData() {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?gid=${CONFIG.SHEET_GID}&tqx=out:json`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const text = await response.text();
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}") + 1;
    if (jsonStart === -1 || jsonEnd === 0) {
      throw new Error("Invalid GViz response format");
    }

    const data = JSON.parse(text.substring(jsonStart, jsonEnd));
    const rows = [];
    const cols = data.table.cols.map((col) => col.label || "");

    data.table.rows.forEach((row) => {
      const item = {};
      cols.forEach((col, index) => {
        const cell = row.c[index];
        item[col] = cell ? cell.f || cell.v || "" : "";
      });
      rows.push(item);
    });

    return rows;
  } catch (error) {
    console.error("Fetch error details:", error);
    throw error;
  }
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
    sort: els.sortSelect?.value || "원문게재일:desc",
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
      if (els.sortSelect) els.sortSelect.value = filterState.sort || "원문게재일:desc";
    }
  } catch (e) {
    console.warn("Failed to load filter state:", e);
  }
}

function setDefaultDates(force = false) {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - CONFIG.DEFAULT_PERIOD_DAYS + 1);

  if (force || !els.startDate.value) els.startDate.value = toDateInputValue(start);
  if (force || !els.endDate.value) els.endDate.value = toDateInputValue(today);
}

function normalizeRows(rows) {
  return rows
    .map((row, index) => {
      const normalized = { id: String(index) };
      REQUIRED_COLUMNS.forEach((column) => {
        normalized[column] = cleanValue(row[column]);
      });
      normalized._publishedDate = parseSheetDate(normalized["원문게재일"]);
      normalized._collectedDate = parseSheetDate(normalized["기사수집일"]);
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

  const text = String(value).trim();
  const dateCtorMatch = text.match(/^Date\((\d+),(\d+),(\d+)/);
  if (dateCtorMatch) {
    return new Date(
      Number(dateCtorMatch[1]),
      Number(dateCtorMatch[2]),
      Number(dateCtorMatch[3]),
    );
  }

  const isoMatch = text.match(/(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})/);
  if (isoMatch) {
    return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function populateFilters() {
  setCheckboxOptions(els.regionFilter, uniqueValues(state.rows, "지역"), getInitialSelection("region", els.regionFilter));
  setCheckboxOptions(els.sectorFilter, uniqueValues(state.rows, "섹터"), getInitialSelection("sector", els.sectorFilter));
  setCheckboxOptions(
    els.infoClassFilter,
    uniqueValues(state.rows, "정보 분류"),
    getInitialSelection("infoClass", els.infoClassFilter),
  );
  updateCountryOptions();
  savedFilterState = null;
}

function updateCountryOptions() {
  const selectedRegions = getCheckedValues(els.regionFilter);
  const source = selectedRegions.length
    ? state.rows.filter((row) => selectedRegions.includes(row["지역"]))
    : state.rows;
  setCheckboxOptions(els.countryFilter, uniqueValues(source, "국가"), getInitialSelection("country", els.countryFilter));
}

function getInitialSelection(key, container) {
  const current = getCheckedValues(container);
  if (current.length) return current;
  return asArray(savedFilterState?.[key]);
}

function uniqueValues(rows, key) {
  return [...new Set(rows.map((row) => row[key]).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ko"),
  );
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
    const keywordOk =
      !keyword ||
      [
        "제목(한글)",
        "제목(원문)",
        "내용",
        "국가",
        "지역",
        "섹터",
        "주제",
        "정보 분류",
        "프로젝트명",
      ].some((key) => row[key].toLowerCase().includes(keyword));

    return dateOk && regionOk && countryOk && sectorOk && infoClassOk && keywordOk;
  });

  rows = sortRows(rows, els.sortSelect?.value || "원문게재일:desc");
  state.filteredRows = rows;
  updateSummary();
  renderRows();
  updateActiveFilterText();
  saveFilterState();
}

function sortRows(rows, sortValue) {
  const [key, direction] = sortValue.split(":");
  const multiplier = direction === "desc" ? -1 : 1;

  return [...rows].sort((a, b) => {
    if (key.includes("일")) {
      const timeA = (key === "원문게재일" ? a._publishedDate : a._collectedDate)?.getTime() || 0;
      const timeB = (key === "원문게재일" ? b._publishedDate : b._collectedDate)?.getTime() || 0;
      return (timeA - timeB) * multiplier;
    }
    return a[key].localeCompare(b[key], "ko") * multiplier;
  });
}

function updateSummary() {
  const totalCountries = uniqueValues(state.rows, "국가").length;
  const totalSectors = uniqueValues(state.rows, "섹터").length;
  const latest = state.rows
    .map((row) => row._publishedDate)
    .filter(Boolean)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  if (els.totalCount) els.totalCount.textContent = numberFormat(state.rows.length);
  if (els.filteredCount) els.filteredCount.textContent = numberFormat(state.filteredRows.length);
  if (els.countryCount) els.countryCount.textContent = numberFormat(totalCountries);
  if (els.sectorCount) els.sectorCount.textContent = numberFormat(totalSectors);
  if (els.latestDate) els.latestDate.textContent = latest ? formatDate(latest) : "-";
  if (els.resultCountLabel) {
    const shownCount = Math.min(state.filteredRows.length, CONFIG.DISPLAY_LIMIT);
    els.resultCountLabel.textContent =
      state.filteredRows.length > CONFIG.DISPLAY_LIMIT
        ? `${numberFormat(shownCount)}건 표시 / 전체 ${numberFormat(state.filteredRows.length)}건`
        : `${numberFormat(state.filteredRows.length)}건`;
  }
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
    if (isExpanded) {
      fragment.appendChild(createDetailRow(row));
    }
  });
  if (els.resultBody) els.resultBody.appendChild(fragment);
}

function createMainRow(row, isExpanded) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td class="date-cell">${escapeHtml(formatDate(row._publishedDate) || row["원문게재일"])}</td>
    <td><span class="pill">${escapeHtml(row["지역"] || "-")}</span></td>
    <td>${escapeHtml(row["국가"] || "-")}</td>
    <td>${escapeHtml(row["섹터"] || "-")}</td>
    <td>${escapeHtml(row["주제"] || "-")}</td>
    <td><span class="pill info-pill">${escapeHtml(row["정보 분류"] || "-")}</span></td>
    <td>${renderTitleLink(row)}</td>
    <td><button class="detail-button" type="button" aria-expanded="${isExpanded}" aria-label="상세 보기">${
      isExpanded ? "−" : "+"
    }</button></td>
  `;

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
  tr.innerHTML = `
    <td colspan="8">
      <div class="detail-panel">
        <div>
          <h3>${escapeHtml(row["제목(원문)"] || row["제목(한글)"] || "원문 제목 없음")}</h3>
          ${renderProjectBlock(row)}
          <p>${escapeHtml(row["내용"] || "내용 요약이 없습니다.")}</p>
        </div>
        <div class="detail-meta">
          ${row["정보 분류"] ? `<span><strong>정보 분류</strong> ${escapeHtml(row["정보 분류"])}</span>` : ""}
          ${row["관련 단계"] ? `<span><strong>관련 단계</strong> ${escapeHtml(row["관련 단계"])}</span>` : ""}
          <span><strong>기사수집일</strong> ${escapeHtml(formatDate(row._collectedDate) || row["기사수집일"] || "-")}</span>
          <span><strong>출처언어</strong> ${escapeHtml(row["출처언어"] || "-")}</span>
          ${row["출처링크"] ? `<a href="${escapeAttribute(row["출처링크"])}" target="_blank" rel="noreferrer">원문 링크 열기</a>` : "<span>원문 링크 없음</span>"}
        </div>
      </div>
    </td>
  `;
  return tr;
}

function renderProjectBlock(row) {
  if (!isProjectArticle(row)) return "";

  const projectName = row["프로젝트명"] || "프로젝트명 미입력";
  const detailUrl = buildProjectDetailUrl(row);

  return `
    <div class="project-callout">
      <div>
        <strong>프로젝트명</strong>
        <span>${escapeHtml(projectName)}</span>
      </div>
      <a class="project-detail-link" href="${escapeAttribute(detailUrl)}">프로젝트 상세페이지</a>
    </div>
  `;
}

function isProjectArticle(row) {
  return row["정보 분류"] === "프로젝트 정보" || Boolean(row["프로젝트명"]);
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
  if (!row["출처링크"]) {
    return `<span class="title-link">${escapeHtml(title)}</span>`;
  }
  return `<a class="title-link" href="${escapeAttribute(row["출처링크"])}" target="_blank" rel="noreferrer">${escapeHtml(title)}</a>`;
}

function toggleDetail(id) {
  if (state.expanded.has(id)) {
    state.expanded.delete(id);
  } else {
    state.expanded.add(id);
  }
  renderRows();
}

function updateActiveFilterText() {
  const filters = [];
  if (els.startDate?.value || els.endDate?.value) {
    filters.push(`${els.startDate?.value || "전체"} ~ ${els.endDate?.value || "전체"}`);
  }
  if (els.keywordInput?.value?.trim()) filters.push(`검색: ${els.keywordInput.value.trim()}`);
  pushSelectedFilter(filters, "지역", getCheckedValues(els.regionFilter));
  pushSelectedFilter(filters, "국가", getCheckedValues(els.countryFilter));
  pushSelectedFilter(filters, "섹터", getCheckedValues(els.sectorFilter));
  pushSelectedFilter(filters, "정보 분류", getCheckedValues(els.infoClassFilter));
  if (els.activeFilterText) {
    els.activeFilterText.textContent = filters.length ? filters.join(" · ") : "전체 기간";
  }
}

function pushSelectedFilter(filters, label, values) {
  if (!values.length) return;
  const suffix = values.length > 1 ? ` 외 ${values.length - 1}` : "";
  filters.push(`${label}: ${values[0]}${suffix}`);
}

function showError() {
  if (els.loadingState) els.loadingState.hidden = true;
  if (els.errorState) els.errorState.hidden = false;
  if (els.emptyState) els.emptyState.hidden = true;
  if (els.tableWrap) els.tableWrap.hidden = true;
  if (els.limitNotice) els.limitNotice.hidden = true;
  if (els.syncStatus) els.syncStatus.textContent = "데이터 연결 실패 - Google Sheets 공개 설정을 확인해주세요";
}

function exportToCSV() {
  if (state.filteredRows.length === 0) {
    alert("내보낼 데이터가 없습니다.");
    return;
  }

  try {
    els.exportButton.disabled = true;
    els.exportButton.textContent = "내보내는 중...";

    const headers = EXPORT_COLUMNS;
    const csvContent = [
      headers.map((h) => `"${h}"`).join(","),
      ...state.filteredRows.map((row) =>
        headers.map((col) => `"${String(row[col] || "").replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `market-monitoring-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (error) {
    console.error("Export failed:", error);
    alert("내보내기 중 오류가 발생했습니다.");
  } finally {
    els.exportButton.disabled = false;
    els.exportButton.textContent = "📥 내보내기";
  }
}

function formatDate(date) {
  if (!date || Number.isNaN(date.getTime())) return "";
  return toDateInputValue(date);
}

function formatDateTime(date) {
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
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
