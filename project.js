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
