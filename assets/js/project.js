/* =========================================================
   source: project.js
   ========================================================= */

const CONFIG = {
  PROJECT_DATA_URL: "./data/projects.json",
  ARTICLE_DATA_URL: "./data/articles.json",
  META_URL: "./data/meta.json",
  SHEET_ID: "11WmfuDj7FSk5LRvEB2CArVETZOA9NgpySLYscG223-E",
  RESULT_GID: "748239675",
  PROJECT_GID: "20260612",
  RESULT_RANGE: "A1:S50000",
  PROJECT_RANGE: "A1:U20000",
};

const RESULT_COLUMNS = [
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
  "관심도",
  "관심도 집계",
  "관심수",
  "하트수",
  "관심도 수치",
];

const INTEREST_COUNT_COLUMNS = ["관심도", "관심도 집계", "관심수", "하트수", "관심도 수치"];
const AI_PROJECT_COLUMNS = ["사업비 확인상태", "AI추정사업비", "AI 추정 신뢰도", "AI 추정근거", "AI 규모 노출등급"];

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
  ...AI_PROJECT_COLUMNS,
];

const els = {
  syncStatus: document.getElementById("syncStatus"),
  projectTitle: document.getElementById("projectTitle"),
  projectSubtitle: document.getElementById("projectSubtitle"),
  loadingState: document.getElementById("loadingState"),
  errorState: document.getElementById("errorState"),
  emptyState: document.getElementById("emptyState"),
  projectContent: document.getElementById("projectContent"),
  projectMetaGrid: document.getElementById("projectMetaGrid"),
  projectArticles: document.getElementById("projectArticles"),
  backToTopButton: document.getElementById("backToTopButton"),
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  if (els.backToTopButton) {
    els.backToTopButton.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const criteria = {
      projectName: cleanValue(params.get("name")),
      country: cleanValue(params.get("country")),
      sector: cleanValue(params.get("sector")),
      projectId: cleanValue(params.get("id")),
    };

    const [projectRows, resultRows, meta] = await Promise.all([
      fetchAndNormalize(CONFIG.PROJECT_DATA_URL, PROJECT_COLUMNS, CONFIG.PROJECT_GID, CONFIG.PROJECT_RANGE),
      fetchAndNormalize(CONFIG.ARTICLE_DATA_URL, RESULT_COLUMNS, CONFIG.RESULT_GID, CONFIG.RESULT_RANGE),
      fetchJson(CONFIG.META_URL).catch(() => null),
    ]);

    let project = findProject(projectRows, criteria);
    if (!project && criteria.projectId) {
      const article = resultRows.find((row) => cleanValue(row["프로젝트 고유값"]) === criteria.projectId);
      if (article) project = projectFromArticle(article, criteria);
    }

    if (!project) {
      showEmpty(criteria.projectId || criteria.projectName || criteria.country || criteria.sector || "프로젝트 정보 없음");
      return;
    }

    const articles = buildArticleItems(project, resultRows);
    renderProject(project, articles);
    const updatedAt = meta?.updatedAt;
    els.syncStatus.textContent = updatedAt ? `캐시 기준 ${formatDateTime(new Date(updatedAt))}` : `캐시 기준 ${formatDateTime(new Date())}`;
  } catch (error) {
    console.error("Project fetch error:", error);
    showError();
  }
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-cache" });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return response.json();
}

async function fetchAndNormalize(path, columns, gid, range) {
  const payload = await fetchRowsWithSheetFallback(path, gid, range);
  const rows = Array.isArray(payload) ? payload : payload?.articles || payload?.projects || [];
  return rows
    .map((row, index) => {
      const normalized = { id: row["프로젝트 고유값"] || row["기사 고유값"] || String(index) };
      columns.forEach((column) => {
        normalized[column] = cleanValue(row[column]);
      });
      return normalized;
    })
    .filter((row) => columns.some((column) => row[column]));
}

async function fetchRowsWithSheetFallback(path, gid, range) {
  try {
    const payload = await fetchJson(path);
    const rows = Array.isArray(payload) ? payload : payload?.rows || payload?.articles || payload?.projects || [];
    if (rows.length && (path !== CONFIG.PROJECT_DATA_URL || rowsIncludeAiColumns(rows))) return rows;
    throw new Error(`Static cache is empty or incomplete: ${path}`);
  } catch (error) {
    console.warn("Static cache unavailable; reading source sheet once.", error);
    if (els.syncStatus) els.syncStatus.textContent = "캐시 비어 있음 - 시트 원본 확인 중...";
    return fetchSheetRows(gid, path === CONFIG.PROJECT_DATA_URL ? CONFIG.PROJECT_RANGE : range);
  }
}

function rowsIncludeAiColumns(rows) {
  return rows.some((row) => AI_PROJECT_COLUMNS.some((column) => Object.prototype.hasOwnProperty.call(row, column)));
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

function findProject(projectRows, criteria) {
  const id = normalizeKey(criteria.projectId);
  const name = normalizeKey(criteria.projectName);
  const looseName = looseKey(criteria.projectName);
  const country = normalizeKey(criteria.country);
  const sector = normalizeKey(criteria.sector);

  if (id) {
    const byId = projectRows.find((row) => normalizeKey(row["프로젝트 고유값"]) === id);
    if (byId) return byId;
  }

  if (name) {
    const byName = projectRows.find((row) => {
      const countryOk = !country || normalizeKey(row["국가"]) === country;
      const sectorOk = !sector || normalizeKey(row["섹터"]) === sector;
      return normalizeKey(row["프로젝트명"]) === name && countryOk && sectorOk;
    });
    if (byName) return byName;
  }

  if (looseName) {
    return projectRows.find((row) => {
      const rowName = looseKey(row["프로젝트명"]);
      const countryOk = !country || normalizeKey(row["국가"]) === country;
      const sectorOk = !sector || normalizeKey(row["섹터"]) === sector;
      return rowName && (rowName === looseName || rowName.includes(looseName) || looseName.includes(rowName)) && countryOk && sectorOk;
    });
  }

  return null;
}

function projectFromArticle(article, criteria) {
  return {
    id: "fallback-project",
    "프로젝트 고유값": cleanValue(article["프로젝트 고유값"] || criteria.projectId),
    "프로젝트명": cleanValue(article["프로젝트명"] || criteria.projectName || criteria.projectId),
    "지역": cleanValue(article["지역"]),
    "국가": cleanValue(article["국가"] || criteria.country),
    "섹터": cleanValue(article["섹터"] || criteria.sector),
    "발주처": "-",
    "사업비(달러 기준 추정액)": "사업비 미확인",
    "사업비 환산 환율 / 기준": "-",
    "현재 단계": cleanValue(article["관련 단계"]),
    "최근 업데이트일": cleanValue(article["원문게재일"]),
    "대표 기사 고유값": cleanValue(article["기사 고유값"]),
    "비고": "프로젝트 탭 기준행이 없어 결과 탭 기사 기준으로 표시",
    "대표 기사 정보 분류": cleanValue(article["정보 분류"] || "프로젝트 정보"),
  };
}

function buildArticleItems(project, resultRows = []) {
  const projectId = normalizeKey(project["프로젝트 고유값"]);
  const projectName = normalizeKey(project["프로젝트명"]);
  const country = project["국가"];
  const sector = project["섹터"];
  const representativeArticleId = project["대표 기사 고유값"];
  const seenArticleIds = new Set();
  const items = [];

  resultRows.forEach((article) => {
    const articleId = article["기사 고유값"];
    if (!articleId || seenArticleIds.has(articleId)) return;

    const idMatch = projectId && normalizeKey(article["프로젝트 고유값"]) === projectId;
    const representativeMatch = representativeArticleId && articleId === representativeArticleId;
    const nameMatch =
      projectName &&
      normalizeKey(article["프로젝트명"]) === projectName &&
      (!country || article["국가"] === country) &&
      (!sector || article["섹터"] === sector);
    if (!idMatch && !representativeMatch && !nameMatch) return;

    seenArticleIds.add(articleId);
    items.push({
      mapping: {
        "기사 고유값": articleId,
        "기사일자": article["원문게재일"] || project["최근 업데이트일"],
        "기사 시점 단계": article["관련 단계"] || project["현재 단계"],
        "해당 기사 기준 사업비": project["사업비(달러 기준 추정액)"],
        "대표기사 여부": representativeMatch ? "Y" : "",
      },
      article,
    });
  });

  return collapseDuplicateArticleItems(items);
}

function collapseDuplicateArticleItems(items) {
  const byStrictKey = new Map();
  const byTitleKey = new Map();
  items.forEach((item) => {
    const strictKey = getStrictDuplicateKey(item);
    const titleKey = getTitleDuplicateKey(item);
    const existing = byStrictKey.get(strictKey) || byTitleKey.get(titleKey);
    if (existing) {
      const preferred = choosePreferredArticleItem(existing, item);
      byStrictKey.set(getStrictDuplicateKey(preferred), preferred);
      byTitleKey.set(getTitleDuplicateKey(preferred), preferred);
      return;
    }
    byStrictKey.set(strictKey, item);
    byTitleKey.set(titleKey, item);
  });
  return Array.from(new Set(byStrictKey.values())).sort(
    (a, b) => (parseSheetDate(b.mapping["기사일자"])?.getTime() || 0) - (parseSheetDate(a.mapping["기사일자"])?.getTime() || 0),
  );
}

function getStrictDuplicateKey({ mapping, article }) {
  return [
    article["프로젝트 고유값"] || normalizeKey(article["프로젝트명"]),
    mapping["기사일자"] || article["원문게재일"],
    mapping["기사 시점 단계"] || article["관련 단계"],
    normalizeSourceLink(article["출처링크"]),
  ].join("|");
}

function getTitleDuplicateKey({ mapping, article }) {
  return [
    article["프로젝트 고유값"] || normalizeKey(article["프로젝트명"]),
    mapping["기사일자"] || article["원문게재일"],
    mapping["기사 시점 단계"] || article["관련 단계"],
    normalizeComparableTitle(article["제목(원문)"] || article["제목(한글)"]),
  ].join("|");
}

function choosePreferredArticleItem(current, candidate) {
  return scoreArticleItem(candidate) > scoreArticleItem(current) ? candidate : current;
}

function scoreArticleItem({ mapping, article }) {
  let score = 0;
  if (mapping["대표기사 여부"] === "Y") score += 100;
  if (article["출처링크"]) score += 20;
  if (article["내용"] && article["내용"].length > 80) score += 10;
  if (article["제목(원문)"]) score += 5;
  if (article["출처언어"]) score += 2;
  return score;
}

function normalizeSourceLink(value) {
  const text = cleanValue(value);
  if (!text) return "";
  try {
    const url = new URL(text);
    url.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"].forEach((key) => {
      url.searchParams.delete(key);
    });
    return `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}?${url.searchParams.toString()}`;
  } catch (error) {
    return text.toLowerCase();
  }
}

function normalizeComparableTitle(value) {
  return normalizeKey(value)
    .replace(/[\s\-_:|/\\.,'"()[\]{}]+/g, " ")
    .replace(/\b(project|tender|contract|award|construction|infrastructure|development)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function renderProject(project, articleItems) {
  const latestDate = parseSheetDate(project["최근 업데이트일"]);
  const costText = project["사업비(달러 기준 추정액)"] || "사업비 미확인";
  const officialCostKnown = isKnownCostText(costText);
  const aiCostText = project["AI추정사업비"] || "";
  const hasAiEstimate = !officialCostKnown && isKnownCostText(aiCostText);
  const metaCards = [
    metaCard("지역", project["지역"] || "-"),
    metaCard("국가", project["국가"] || "-"),
    metaCard("섹터", project["섹터"] || "-"),
    metaCard("발주처", project["발주처"] || "-"),
    metaCard("사업비(USD)", formatCost(costText)),
  ];

  if (hasAiEstimate) {
    metaCards.push(metaCard("AI 추정사업비", `${formatCost(aiCostText)} (AI 추정)`));
    if (project["AI 추정 신뢰도"]) metaCards.push(metaCard("AI 추정 신뢰도", project["AI 추정 신뢰도"]));
    if (project["AI 추정근거"]) metaCards.push(metaCard("AI 추정근거", project["AI 추정근거"]));
  }

  metaCards.push(
    metaCard("환산 기준", project["사업비 환산 환율 / 기준"] || "-"),
    metaCard("현재 단계", project["현재 단계"] || "-"),
    metaCard("최근 업데이트일", formatDate(latestDate) || project["최근 업데이트일"] || "-"),
    metaCard("관련 기사", `${numberFormat(articleItems.length)}건`),
  );

  els.loadingState.hidden = true;
  els.errorState.hidden = true;
  els.emptyState.hidden = true;
  els.projectContent.hidden = false;
  els.projectTitle.textContent = project["프로젝트명"] || "프로젝트명 미입력";
  els.projectSubtitle.textContent = `${project["국가"] || "국가 미확인"} · ${project["섹터"] || "섹터 미확인"} · 관련 기사 ${numberFormat(articleItems.length)}건`;
  els.projectMetaGrid.innerHTML = metaCards.join("");
  els.projectArticles.innerHTML = articleItems.length ? articleItems.map(renderArticleCard).join("") : `<div class="state-box">연결된 관련 기사가 없습니다.</div>`;
}

function isKnownCostText(value) {
  const text = String(value || "").trim().toLowerCase();
  return Boolean(text) && !/사업비\s*미확인|미공개|환산\s*미공개|ai\s*추정\s*불가|unknown|n\/a|tbd|not\s+disclosed/.test(text);
}

function formatCost(value) {
  const text = String(value || "").trim();
  if (!isKnownCostText(text)) return "사업비 미확인";
  return text.replace(/^약\s*/, "").replace(/\s*\(ai\)\s*$/i, "");
}

function renderArticleCard({ mapping, article }) {
  const title = article["제목(한글)"] || article["제목(원문)"] || "제목 없음";
  const articleDate = parseSheetDate(mapping["기사일자"] || article["원문게재일"]);
  const articleId = article["기사 고유값"] || mapping["기사 고유값"] || "";
  const sheetInterestCount = getSheetInterestCount(article);
  return `
    <article class="project-article-card" data-article-id="${escapeAttribute(articleId)}" data-sheet-interest-count="${sheetInterestCount}">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(article["내용"] || "내용 요약이 없습니다.")}</p>
      <div class="project-article-meta">
        <span>${escapeHtml(formatDate(articleDate) || mapping["기사일자"] || article["원문게재일"] || "-")}</span>
        ${mapping["기사 시점 단계"] ? `<span>${escapeHtml(mapping["기사 시점 단계"])}</span>` : ""}
        ${mapping["해당 기사 기준 사업비"] ? `<span>${escapeHtml(formatCost(mapping["해당 기사 기준 사업비"]))}</span>` : ""}
        ${mapping["대표기사 여부"] === "Y" ? `<span>대표 기사</span>` : ""}
        ${article["출처언어"] ? `<span>${escapeHtml(article["출처언어"])}</span>` : ""}
        ${article["출처링크"] ? `<a href="${escapeAttribute(article["출처링크"])}" target="_blank" rel="noreferrer">원문 링크</a>` : ""}
      </div>
    </article>`;
}

function metaCard(label, value) {
  return `
    <div class="project-meta-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "-")}</strong>
    </div>`;
}

function showEmpty(title) {
  els.loadingState.hidden = true;
  els.errorState.hidden = true;
  els.emptyState.hidden = false;
  els.projectContent.hidden = true;
  els.projectTitle.textContent = title;
  els.projectSubtitle.textContent = "프로젝트명, 국가, 섹터 조건을 확인해 주세요.";
  els.syncStatus.textContent = `캐시 기준 ${formatDateTime(new Date())}`;
}

function showError() {
  els.loadingState.hidden = true;
  els.errorState.hidden = false;
  els.errorState.textContent = "캐시 데이터를 불러오지 못했습니다. GitHub Actions의 시트 동기화 실행 상태를 확인해주세요.";
  els.emptyState.hidden = true;
  els.projectContent.hidden = true;
  els.syncStatus.textContent = "캐시 데이터 연결 실패";
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

function normalizeKey(value) {
  return cleanValue(value).toLowerCase();
}

function looseKey(value) {
  return normalizeKey(value).replace(/[\s\-_/.,:|()[\]{}'"]/g, "");
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
