const CONFIG = {
  SHEET_ID: "11WmfuDj7FSk5LRvEB2CArVETZOA9NgpySLYscG223-E",
  SHEET_GID: "748239675",
};

const COLUMNS = [
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
  "사업비(달러 기준 추정액)",
  "사업비",
  "프로젝트 규모",
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
    const projectId = cleanValue(params.get("id"));
    const projectName = cleanValue(params.get("name"));
    const country = cleanValue(params.get("country"));
    const sector = cleanValue(params.get("sector"));
    const rows = normalizeRows(await fetchSheetData());
    const matchedRows = findProjectRows(rows, { projectId, projectName, country, sector });

    if (matchedRows.length === 0) {
      showEmpty(projectName || country || sector || "프로젝트 정보 없음");
      return;
    }

    renderProject(matchedRows, projectName);
    els.syncStatus.textContent = `마지막 불러오기 ${formatDateTime(new Date())}`;
  } catch (error) {
    console.error("Project fetch error:", error);
    showError();
  }
}

async function fetchSheetData() {
  const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?gid=${CONFIG.SHEET_GID}&tqx=out:json`;
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
      item[col] = cell ? (cell.f || cell.v || "") : "";
    });
    return item;
  });
}

function normalizeRows(rows) {
  return rows
    .map((row, index) => {
      const normalized = { id: String(index) };
      COLUMNS.forEach((column) => {
        normalized[column] = cleanValue(row[column]);
      });
      normalized._publishedDate = parseSheetDate(normalized["원문게재일"]);
      normalized._collectedDate = parseSheetDate(normalized["기사수집일"]);
      return normalized;
    })
    .filter((row) => row["원문게재일"] || row["제목(한글)"] || row["제목(원문)"]);
}

function findProjectRows(rows, criteria) {
  const projectNameLower = criteria.projectName.toLowerCase();
  return rows
    .filter((row) => row["정보 분류"] === "프로젝트 정보" || row["프로젝트명"])
    .filter((row) => {
      const idOk = criteria.projectId && row["프로젝트 고유값"] === criteria.projectId;
      const nameOk = projectNameLower && row["프로젝트명"].toLowerCase() === projectNameLower;
      const countryOk = !criteria.country || row["국가"] === criteria.country;
      const sectorOk = !criteria.sector || row["섹터"] === criteria.sector;
      return (idOk || nameOk) && countryOk && sectorOk;
    })
    .sort((a, b) => (b._publishedDate?.getTime() || 0) - (a._publishedDate?.getTime() || 0));
}

function renderProject(rows, fallbackName) {
  const latest = rows[0];
  const projectName = latest["프로젝트명"] || fallbackName || "프로젝트명 미입력";
  const latestDate = formatDate(latest._publishedDate) || latest["원문게재일"] || "-";
  const costText = findProjectCost(rows) || "사업비 미확인";

  els.loadingState.hidden = true;
  els.errorState.hidden = true;
  els.emptyState.hidden = true;
  els.projectContent.hidden = false;
  els.projectTitle.textContent = projectName;
  els.projectSubtitle.textContent = `${latest["국가"] || "국가 미확인"} · ${latest["섹터"] || "섹터 미확인"} · 관련 기사 ${numberFormat(rows.length)}건`;

  els.projectMetaGrid.innerHTML = [
    metaCard("지역", latest["지역"] || "-"),
    metaCard("국가", latest["국가"] || "-"),
    metaCard("섹터", latest["섹터"] || "-"),
    metaCard("사업비", formatCost(costText)),
    metaCard("현재 단계", latest["관련 단계"] || "-"),
    metaCard("최근 업데이트", latestDate),
    metaCard("정보 분류", latest["정보 분류"] || "프로젝트 정보"),
    metaCard("관련 기사", `${numberFormat(rows.length)}건`),
  ].join("");

  els.projectArticles.innerHTML = rows.map(renderArticleCard).join("");
}

function findProjectCost(articles) {
  const costColumns = ["사업비(달러 기준 추정액)", "사업비", "프로젝트 규모"];
  for (const article of articles) {
    for (const column of costColumns) {
      if (article[column]) return article[column];
    }
  }
  return "";
}

function formatCost(value) {
  if (!value || value === "사업비 미확인") return "사업비 미확인";
  return value.includes("$") || value.includes("달러") || value.toLowerCase().includes("usd")
    ? value
    : `${value} (달러 기준)`;
}

function renderArticleCard(row) {
  const title = row["제목(한글)"] || row["제목(원문)"] || "제목 없음";
  const date = formatDate(row._publishedDate) || row["원문게재일"] || "-";
  return `
    <article class="project-article-card">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(row["내용"] || "내용 요약이 없습니다.")}</p>
      <div class="project-article-meta">
        <span>${escapeHtml(date)}</span>
        ${row["관련 단계"] ? `<span>${escapeHtml(row["관련 단계"])}</span>` : ""}
        ${row["출처언어"] ? `<span>${escapeHtml(row["출처언어"])}</span>` : ""}
        ${row["출처링크"] ? `<a href="${escapeAttribute(row["출처링크"])}" target="_blank" rel="noreferrer">원문 링크</a>` : ""}
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
