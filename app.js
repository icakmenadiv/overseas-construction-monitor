const CONFIG = {
  SHEET_ID: "11WmfuDj7FSk5LRvEB2CArVETZOA9NgpySLYscG223-E",
  SHEET_GID: "748239675",
  SHEET_VIEW_URL:
    "https://docs.google.com/spreadsheets/d/11WmfuDj7FSk5LRvEB2CArVETZOA9NgpySLYscG223-E/edit?gid=748239675#gid=748239675",
  DEFAULT_PERIOD_DAYS: 30,
};

const REQUIRED_COLUMNS = [
  "원문게재일",
  "기사수집일",
  "지역",
  "국가",
  "섹터",
  "주제",
  "제목(한글)",
  "제목(원문)",
  "내용",
  "출처언어",
  "출처링크",
];

const state = {
  rows: [],
  filteredRows: [],
  expanded: new Set(),
};

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
  sortSelect: document.getElementById("sortSelect"),
  resetButton: document.getElementById("resetButton"),
  refreshButton: document.getElementById("refreshButton"),
  exportButton: document.getElementById("exportButton"),
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
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  els.sheetLink.href = CONFIG.SHEET_VIEW_URL;
  els.footerSheetLink.href = CONFIG.SHEET_VIEW_URL;
  loadFilterState();
  bindEvents();
  setDefaultDates();

  try {
    const rows = await fetchSheetRowsWithJsonp();
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

  [
    els.keywordInput,
    els.startDate,
    els.endDate,
    els.regionFilter,
    els.countryFilter,
    els.sectorFilter,
    els.sortSelect,
  ].forEach((element) => {
    if (element) element.addEventListener("input", debouncedApplyFilters);
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
      if (els.regionFilter) els.regionFilter.value = "";
      if (els.countryFilter) els.countryFilter.value = "";
      if (els.sectorFilter) els.sectorFilter.value = "";
      if (els.sortSelect) els.sortSelect.value = "원문게재일:desc";
      setDefaultDates();
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
    const rows = await fetchSheetRowsWithJsonp();
    state.rows = normalizeRows(rows);
    populateFilters();
    applyFilters();
    els.syncStatus.textContent = `마지막 불러오기 ${formatDateTime(new Date())}`;
  } catch (error) {
    console.error(error);
    els.syncStatus.textContent = "새로 고침 실패 - 다시 시도해주세요";
  } finally {
    els.refreshButton.disabled = false;
  }
}

function saveFilterState() {
  const filterState = {
    keyword: els.keywordInput?.value || "",
    startDate: els.startDate?.value || "",
    endDate: els.endDate?.value || "",
    region: els.regionFilter?.value || "",
    country: els.countryFilter?.value || "",
    sector: els.sectorFilter?.value || "",
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
      if (els.keywordInput) els.keywordInput.value = filterState.keyword || "";
      if (els.startDate) els.startDate.value = filterState.startDate || "";
      if (els.endDate) els.endDate.value = filterState.endDate || "";
      if (els.regionFilter) els.regionFilter.value = filterState.region || "";
      if (els.countryFilter) els.countryFilter.value = filterState.country || "";
      if (els.sectorFilter) els.sectorFilter.value = filterState.sector || "";
      if (els.sortSelect) els.sortSelect.value = filterState.sort || "원문게재일:desc";
    }
  } catch (e) {
    console.warn("Failed to load filter state:", e);
  }
}

function setDefaultDates() {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - CONFIG.DEFAULT_PERIOD_DAYS + 1);
  
  if (!els.startDate.value) els.startDate.value = toDateInputValue(start);
  if (!els.endDate.value) els.endDate.value = toDateInputValue(today);
}

// JSONP 방식으로 Google Sheets 데이터 가져오기
function fetchSheetRowsWithJsonp() {
  return new Promise((resolve, reject) => {
    const callbackName = `googleSheetCallback_${Date.now()}`;
    const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:json&gid=${CONFIG.SHEET_GID}&callback=${callbackName}`;

    // 전역 콜백 함수 설정
    window[callbackName] = function(response) {
      try {
        // 응답 파싱
        if (response.isError?.()) {
          reject(new Error(`Google Sheets API Error: ${response.getMessage()}`));
          return;
        }

        // 데이터 추출
        const table = response.getDataTable();
        const cols = [];
        const rows = [];

        // 컬럼명 추출
        for (let i = 0; i < table.getNumberOfColumns(); i++) {
          cols.push(table.getColumnLabel(i));
        }

        // 행 데이터 추출
        for (let i = 0; i < table.getNumberOfRows(); i++) {
          const row = {};
          for (let j = 0; j < cols.length; j++) {
            row[cols[j]] = table.getValue(i, j) || "";
          }
          rows.push(row);
        }

        // 콜백 함수 삭제
        delete window[callbackName];

        resolve(rows);
      } catch (error) {
        delete window[callbackName];
        reject(error);
      }
    };

    // 스크립트 태그 생성 및 추가
    const script = document.createElement("script");
    script.src = url;
    script.onerror = () => {
      delete window[callbackName];
      reject(new Error("Failed to load Google Sheets data"));
    };
    document.head.appendChild(script);

    // 타임아웃 설정 (10초)
    setTimeout(() => {
      if (window[callbackName]) {
        delete window[callbackName];
        reject(new Error("Google Sheets API timeout"));
      }
    }, 10000);
  });
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
  setOptions(els.regionFilter, uniqueValues(state.rows, "지역"));
  setOptions(els.sectorFilter, uniqueValues(state.rows, "섹터"));
  updateCountryOptions();
}

function updateCountryOptions() {
  const selectedRegion = els.regionFilter?.value || "";
  const source = selectedRegion
    ? state.rows.filter((row) => row["지역"] === selectedRegion)
    : state.rows;
  const current = els.countryFilter?.value || "";
  setOptions(els.countryFilter, uniqueValues(source, "국가"));
  if ([...els.countryFilter.options].some((option) => option.value === current)) {
    els.countryFilter.value = current;
  }
}

function uniqueValues(rows, key) {
  return [...new Set(rows.map((row) => row[key]).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ko"),
  );
}

function setOptions(select, values) {
  select.innerHTML = '<option value="">전체</option>';
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function applyFilters() {
  const keyword = (els.keywordInput?.value || "").trim().toLowerCase();
  const start = els.startDate?.value ? new Date(`${els.startDate.value}T00:00:00`) : null;
  const end = els.endDate?.value ? new Date(`${els.endDate.value}T23:59:59`) : null;
  const region = els.regionFilter?.value || "";
  const country = els.countryFilter?.value || "";
  const sector = els.sectorFilter?.value || "";

  let rows = state.rows.filter((row) => {
    const date = row._publishedDate;
    const dateOk = (!start || (date && date >= start)) && (!end || (date && date <= end));
    const regionOk = !region || row["지역"] === region;
    const countryOk = !country || row["국가"] === country;
    const sectorOk = !sector || row["섹터"] === sector;
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
      ].some((key) => row[key].toLowerCase().includes(keyword));

    return dateOk && regionOk && countryOk && sectorOk && keywordOk;
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
  if (els.resultCountLabel) els.resultCountLabel.textContent = `${numberFormat(state.filteredRows.length)}건`;
}

function renderRows() {
  if (els.loadingState) els.loadingState.hidden = true;
  if (els.errorState) els.errorState.hidden = true;
  if (els.emptyState) els.emptyState.hidden = state.filteredRows.length > 0;
  if (els.tableWrap) els.tableWrap.hidden = state.filteredRows.length === 0;
  if (els.resultBody) els.resultBody.innerHTML = "";

  const fragment = document.createDocumentFragment();
  state.filteredRows.forEach((row) => {
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
    <td>${renderTitleLink(row)}</td>
    <td>${escapeHtml(row["출처언어"] || "-")}</td>
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
          <p>${escapeHtml(row["내용"] || "내용 요약이 없습니다.")}</p>
        </div>
        <div class="detail-meta">
          <span><strong>기사수집일</strong> ${escapeHtml(formatDate(row._collectedDate) || row["기사수집일"] || "-")}</span>
          <span><strong>출처언어</strong> ${escapeHtml(row["출처언어"] || "-")}</span>
          ${row["출처링크"] ? `<a href="${escapeAttribute(row["출처링크"])}" target="_blank" rel="noreferrer">원문 링크 열기</a>` : "<span>원문 링크 없음</span>"}
        </div>
      </div>
    </td>
  `;
  return tr;
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
  if (els.regionFilter?.value) filters.push(`지역: ${els.regionFilter.value}`);
  if (els.countryFilter?.value) filters.push(`국가: ${els.countryFilter.value}`);
  if (els.sectorFilter?.value) filters.push(`섹터: ${els.sectorFilter.value}`);
  if (els.activeFilterText) {
    els.activeFilterText.textContent = filters.length ? filters.join(" · ") : "전체 기간";
  }
}

function showError() {
  if (els.loadingState) els.loadingState.hidden = true;
  if (els.errorState) els.errorState.hidden = false;
  if (els.emptyState) els.emptyState.hidden = true;
  if (els.tableWrap) els.tableWrap.hidden = true;
  if (els.syncStatus) els.syncStatus.textContent = "데이터 연결 실패 - Google Sheets 공개 설정 확인";
}

function exportToCSV() {
  if (state.filteredRows.length === 0) {
    alert("내보낼 데이터가 없습니다.");
    return;
  }

  try {
    els.exportButton.disabled = true;
    els.exportButton.textContent = "내보내는 중...";

    const headers = REQUIRED_COLUMNS;
    const csvContent = [
      headers.map((h) => `"${h}"`).join(","),
      ...state.filteredRows.map((row) =>
        headers
          .map((col) => `"${String(row[col] || "").replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `dashboard-${new Date().toISOString().split("T")[0]}.csv`;
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
