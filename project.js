const CONFIG = {
  SHEET_ID: "11WmfuDj7FSk5LRvEB2CArVETZOA9NgpySLYscG223-E",
  RESULT_SHEET_GID: "748239675",
  PROJECT_SHEET_GID: "20260612",
  MAPPING_SHEET_GID: "20260614",
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
];

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
];

const MAPPING_COLUMNS = [
  "프로젝트 고유값",
  "기사 고유값",
  "기사일자",
  "기사 시점 단계",
  "해당 기사 기준 사업비",
  "대표기사 여부",
  "비고",
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
    els.backToTopButton.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const criteria = {
      projectName: cleanValue(params.get("name")),
      country: cleanValue(params.get("country")),
      sector: cleanValue(params.get("sector")),
      projectId: cleanValue(params.get("id")),
    };

    const [projectRows, mappingRows, resultRows] = await Promise.all([
      fetchAndNormalize(CONFIG.PROJECT_SHEET_GID, PROJECT_COLUMNS),
      fetchAndNormalize(CONFIG.MAPPING_SHEET_GID, MAPPING_COLUMNS),
      fetchAndNormalize(CONFIG.RESULT_SHEET_GID, RESULT_COLUMNS),
    ]);

    const project = findProject(projectRows, criteria);
    if (!project) {
      showEmpty(criteria.projectName || criteria.country || criteria.sector || "프로젝트 정보 없음");
      return;
    }

    const mappings = mappingRows.filter((row) => row["프로젝트 고유값"] === project["프로젝트 고유값"]);
    const articleMap = new Map(resultRows.map((row) => [row["기사 고유값"], row]));
    const articles = buildArticleItems(project, mappings, articleMap);

    renderProject(project, articles);
    els.syncStatus.textContent = `마지막 불러오기 ${formatDateTime(new Date())}`;
  } catch (error) {
    console.error("Project fetch error:", error);
    showError();
  }
}

async function fetchAndNormalize(gid, columns) {
  const rows = await fetchSheetData(gid);
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

function findProject(projectRows, criteria) {
  const projectNameLower = criteria.projectName.toLowerCase();
  return projectRows.find((row) => {
    const idOk = criteria.projectId && row["프로젝트 고유값"] === criteria.projectId;
    const nameOk = projectNameLower && row["프로젝트명"].toLowerCase() === projectNameLower;
    const countryOk = !criteria.country || row["국가"] === criteria.country;
    const sectorOk = !criteria.sector || row["섹터"] === criteria.sector;
    return (idOk || nameOk) && countryOk && sectorOk;
  });
}

function buildArticleItems(project, mappings, articleMap) {
  const seenArticleIds = new Set();
  const items = mappings
    .map((mapping) => ({ mapping, article: articleMap.get(mapping["기사 고유값"]) }))
    .filter((item) => {
      if (!item.article) return false;
      const articleId = item.mapping["기사 고유값"];
      if (seenArticleIds.has(articleId)) return false;
      seenArticleIds.add(articleId);
      return true;
    });

  const representativeArticleId = project["대표 기사 고유값"];
  if (representativeArticleId && !seenArticleIds.has(representativeArticleId)) {
    const representativeArticle = articleMap.get(representativeArticleId);
    if (representativeArticle) {
      items.push({
        mapping: {
          "기사 고유값": representativeArticleId,
          "기사일자": representativeArticle["원문게재일"] || project["최근 업데이트일"],
          "기사 시점 단계": representativeArticle["관련 단계"] || project["현재 단계"],
          "해당 기사 기준 사업비": project["사업비(달러 기준 추정액)"],
          "대표기사 여부": "Y",
          "비고": "프로젝트 탭 대표기사 기준 자동 표시",
        },
        article: representativeArticle,
      });
    }
  }

  return items.sort(
    (a, b) =>
      (parseSheetDate(b.mapping["기사일자"])?.getTime() || 0) -
      (parseSheetDate(a.mapping["기사일자"])?.getTime() || 0),
  );
}

function renderProject(project, articleItems) {
  const latestDate = parseSheetDate(project["최근 업데이트일"]);
  const costText = project["사업비(달러 기준 추정액)"] || "사업비 미확인";

  els.loadingState.hidden = true;
  els.errorState.hidden = true;
  els.emptyState.hidden = true;
  els.projectContent.hidden = false;
  els.projectTitle.textContent = project["프로젝트명"] || "프로젝트명 미입력";
  els.projectSubtitle.textContent = `${project["국가"] || "국가 미확인"} · ${project["섹터"] || "섹터 미확인"} · 관련 기사 ${numberFormat(articleItems.length)}건`;

  els.projectMetaGrid.innerHTML = [
    metaCard("지역", project["지역"] || "-"),
    metaCard("국가", project["국가"] || "-"),
    metaCard("섹터", project["섹터"] || "-"),
    metaCard("발주처", project["발주처"] || "-"),
    metaCard("사업비(USD)", formatCost(costText)),
    metaCard("환산 기준", project["사업비 환산 환율 / 기준"] || "-"),
    metaCard("현재 단계", project["현재 단계"] || "-"),
    metaCard("최근 업데이트일", formatDate(latestDate) || project["최근 업데이트일"] || "-"),
    metaCard("관련 기사", `${numberFormat(articleItems.length)}건`),
  ].join("");

  els.projectArticles.innerHTML = articleItems.length
    ? articleItems.map(renderArticleCard).join("")
    : `<div class="state-box">연결된 관련 기사가 없습니다.</div>`;
}

function formatCost(value) {
  const text = String(value || "").trim();
  if (!text || text === "사업비 미확인" || text === "미공개") return "사업비 미확인";
  return text.replace(/^약\s*/, "");
}

function renderArticleCard({ mapping, article }) {
  const title = article["제목(한글)"] || article["제목(원문)"] || "제목 없음";
  const articleDate = parseSheetDate(mapping["기사일자"] || article["원문게재일"]);
  return `
    <article class="project-article-card">
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
    </article>
  `;
}

function metaCard(label, value) {
  return `
    <div class="project-meta-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "-")}</strong>
    </div>
  `;
}

function showEmpty(title) {
  els.loadingState.hidden = true;
  els.errorState.hidden = true;
  els.emptyState.hidden = false;
  els.projectContent.hidden = true;
  els.projectTitle.textContent = title;
  els.projectSubtitle.textContent = "프로젝트명, 국가, 섹터 조건을 확인해 주세요.";
  els.syncStatus.textContent = `마지막 불러오기 ${formatDateTime(new Date())}`;
}

function showError() {
  els.loadingState.hidden = true;
  els.errorState.hidden = false;
  els.emptyState.hidden = true;
  els.projectContent.hidden = true;
  els.syncStatus.textContent = "데이터 연결 실패";
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
