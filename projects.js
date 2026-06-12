const CONFIG = {
  SHEET_ID: "11WmfuDj7FSk5LRvEB2CArVETZOA9NgpySLYscG223-E",
  PROJECT_SHEET_GID: "20260612",
  SMALL_COST_THRESHOLD_USD: 1_000_000,
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

const state = {
  projects: [],
  filteredProjects: [],
};

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
  if (eyebrow) eyebrow.textContent = "해외건설협회 통합 모니터링";
  if (title) title.textContent = "해외 건설시장 모니터링";
  if (subtitle) {
    subtitle.textContent = "해외건설협회가 수집한 해외 건설·인프라 시장뉴스와 프로젝트 정보를 통합 조회합니다.";
  }
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
      if (els.includeSmallCost) els.includeSmallCost.checked = false;
      if (els.includeUnknownCost) els.includeUnknownCost.checked = false;
      if (els.sortSelect) els.sortSelect.value = "cost:desc";
      updateCountryOptions();
      applyFilters();
    });
  }

  if (els.refreshButton) els.refreshButton.addEventListener("click", loadProjects);
  if (els.backToTopButton) {
    els.backToTopButton.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }
}

async function loadProjects() {
  try {
    if (els.refreshButton) els.refreshButton.disabled = true;
    if (els.syncStatus) els.syncStatus.textContent = "데이터 새로 고침 중...";

    const rows = normalizeRows(await fetchSheetData(CONFIG.PROJECT_SHEET_GID), PROJECT_COLUMNS);
    state.projects = rows
      .map(normalizeProject)
      .filter((project) => project.name && project.latestDateText);

    populateFilters();
    applyFilters();
    if (els.syncStatus) els.syncStatus.textContent = `마지막 불러오기 ${formatDateTime(new Date())}`;
  } catch (error) {
    console.error("Project monitoring fetch error:", error);
    showError();
  } finally {
    if (els.refreshButton) els.refreshButton.disabled = false;
  }
}

async function fetchSheetData(gid) {
  const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?gid=${gid}&tqx=out:json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

  const text = await response.text();
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}") + 1;
  if (jsonStart === -1 || jsonEnd === 0) throw new Error("Invalid GViz response format");

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

function normalizeRows(rows, columns) {
  return rows
    .map((row, index) => {
      const normalized = { id: String(index) };
      columns.forEach((column) => {
        normalized[column] = cleanValue(row[column]);
      });
      return normalized;
    })
    .filter((row) => columns.some((column) => row[column]));
}

function normalizeProject(row) {
  const costText = row["사업비(달러 기준 추정액)"] || "사업비 미확인";
  const costValue = parseCostValue(costText);
  const latestDate = parseSheetDate(row["최근 업데이트일"]);
  const latestDateText = formatDate(latestDate) || row["최근 업데이트일"];

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
    representativeArticleId: row["대표 기사 고유값"],
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
    uniqueValues(state.projects, "stage").filter((value) => value !== "-"),
    getCheckedValues(els.stageFilter),
  );
  updateCountryOptions();
}

function updateCountryOptions() {
  const selectedRegions = getCheckedValues(els.regionFilter);
  const source = selectedRegions.length
    ? state.projects.filter((project) => selectedRegions.includes(project.region))
    : state.projects;
  setCheckboxOptions(els.countryFilter, uniqueValues(source, "country"), getCheckedValues(els.countryFilter));
}

function applyFilters() {
  const keyword = (els.keywordInput?.value || "").trim().toLowerCase();
  const regions = getCheckedValues(els.regionFilter);
  const countries = getCheckedValues(els.countryFilter);
  const sectors = getCheckedValues(els.sectorFilter);
  const stages = getCheckedValues(els.stageFilter);
  const includeSmallCost = Boolean(els.includeSmallCost?.checked);
  const includeUnknownCost = Boolean(els.includeUnknownCost?.checked);

  let projects = state.projects.filter((project) => {
    const keywordOk =
      !keyword ||
      [project.name, project.owner, project.region, project.country, project.sector, project.stage, project.note]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    const regionOk = !regions.length || regions.includes(project.region);
    const countryOk = !countries.length || countries.includes(project.country);
    const sectorOk = !sectors.length || sectors.includes(project.sector);
    const stageOk = !stages.length || stages.includes(project.stage);
    const unknownCostOk = project.costKnown || includeUnknownCost;
    const smallCostOk = !isSmallCost(project) || includeSmallCost;
    return keywordOk && regionOk && countryOk && sectorOk && stageOk && unknownCostOk && smallCostOk;
  });

  projects = sortProjects(projects, els.sortSelect?.value || "cost:desc");
  state.filteredProjects = projects;
  updateSummary();
  renderProjects();
  updateActiveFilterText();
}

function sortProjects(projects, sortValue) {
  const [key, direction] = sortValue.split(":");
  const multiplier = direction === "desc" ? -1 : 1;
  return [...projects].sort((a, b) => {
    if (key === "cost") return (a.costValue - b.costValue) * multiplier;
    if (key === "latest") return ((a.latestDate?.getTime() || 0) - (b.latestDate?.getTime() || 0)) * multiplier;
    if (key === "country") return a.country.localeCompare(b.country, "ko") * multiplier;
    return a.name.localeCompare(b.name, "ko") * multiplier;
  });
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
      <td><a class="title-link" href="${escapeAttribute(url)}">${escapeHtml(project.name)}</a></td>
      <td><span class="pill">${escapeHtml(project.region || "-")}</span></td>
      <td>${escapeHtml(project.country || "-")}</td>
      <td>${escapeHtml(project.sector || "-")}</td>
      <td>${escapeHtml(project.owner || "-")}</td>
      <td>${escapeHtml(formatCost(project))}</td>
      <td><span class="pill stage-pill">${escapeHtml(project.stage || "-")}</span></td>
      <td class="date-cell">${escapeHtml(project.latestDateText)}</td>
      <td>${escapeHtml(project.note || "-")}</td>
    `;
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
  const latest = state.projects
    .map((project) => project.latestDate)
    .filter(Boolean)
    .sort((a, b) => b.getTime() - a.getTime())[0];
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
  filters.push(els.includeSmallCost?.checked ? "1백만불 이하 포함" : "1백만불 이하 제외");
  filters.push(els.includeUnknownCost?.checked ? "미확인 사업 포함" : "사업비 미확인 제외");
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
  return [...new Set(rows.map((row) => row[key]).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ko"),
  );
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
  els.emptyState.hidden = true;
  els.tableWrap.hidden = true;
  if (els.syncStatus) els.syncStatus.textContent = "데이터 연결 실패 - Google Sheets 공개 설정을 확인해주세요";
}

function cleanValue(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function parseSheetDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  const serial = Number(text);
  if (Number.isFinite(serial) && serial > 20000) {
    return new Date(Math.round((serial - 25569) * 86400 * 1000));
  }
  const dateCtorMatch = text.match(/^Date\((\d+),(\d+),(\d+)/);
  if (dateCtorMatch) {
    return new Date(Number(dateCtorMatch[1]), Number(dateCtorMatch[2]), Number(dateCtorMatch[3]));
  }
  const isoMatch = text.match(/(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})/);
  if (isoMatch) {
    return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  }
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
