import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SHEET_ID = "11WmfuDj7FSk5LRvEB2CArVETZOA9NgpySLYscG223-E";
const RESULT_GID = "748239675";
const PROJECT_GID = "20260612";
const RESULT_RANGE = "A1:Z50000";
const PROJECT_RANGE = "A1:M20000";
const DATA_DIR = "data";
const MODE = parseMode();
const SOURCE_SHEETS = Object.freeze([
  { label: "결과", gid: RESULT_GID, range: RESULT_RANGE, output: "articles.json" },
  { label: "프로젝트", gid: PROJECT_GID, range: PROJECT_RANGE, output: "projects.json" },
]);

const ARTICLE_ID_COLUMN = "기사 고유값";
const PROJECT_ID_COLUMN = "프로젝트 고유값";
const IMPORTANCE_LABEL_COLUMN = "중요도";
const IMPORTANCE_SCORE_COLUMN = "중요도 수치값";
const AI_ADJUSTMENT_COLUMN = "최종 AI 가점";
const IMPORTANCE_DISPLAY_COLUMN = "중요도 표시";
const FINAL_IMPORTANCE_SCORE_COLUMN = "최종 중요도 수치값";
const MIN_ARTICLE_ROWS = 100;
const MIN_PROJECT_ROWS = 20;

async function main() {
  await mkdir(DATA_DIR, { recursive: true });

  const [previousArticles, previousProjects] = await Promise.all([
    readJson(path.join(DATA_DIR, "articles.json"), []),
    readJson(path.join(DATA_DIR, "projects.json"), []),
  ]);

  const [articles, projects] = await Promise.all([
    fetchSheetRows(RESULT_GID, RESULT_RANGE),
    fetchSheetRows(PROJECT_GID, PROJECT_RANGE),
  ]);

  const sheetArticles = normalizeRows(articles, ARTICLE_ID_COLUMN).map(decorateArticleImportanceScore);
  const sheetProjects = normalizeRows(projects, PROJECT_ID_COLUMN);
  assertHealthySheetRead(sheetArticles, previousArticles, ARTICLE_ID_COLUMN, "articles", MIN_ARTICLE_ROWS);
  assertHealthySheetRead(sheetProjects, previousProjects, PROJECT_ID_COLUMN, "projects", MIN_PROJECT_ROWS);

  const cleanArticles = mergeRows(previousArticles, sheetArticles, ARTICLE_ID_COLUMN, MODE).sort(compareArticleRows);
  const cleanProjects = mergeRows(previousProjects, sheetProjects, PROJECT_ID_COLUMN, MODE).sort(compareProjectRows);

  const articleDiff = diffRows(previousArticles, cleanArticles, ARTICLE_ID_COLUMN);
  const projectDiff = diffRows(previousProjects, cleanProjects, PROJECT_ID_COLUMN);
  const meta = {
    updatedAt: new Date().toISOString(),
    source: {
      spreadsheetId: SHEET_ID,
      resultGid: RESULT_GID,
      projectGid: PROJECT_GID,
      resultRange: RESULT_RANGE,
      projectRange: PROJECT_RANGE,
      sourceTabs: SOURCE_SHEETS.map(({ label, gid, range, output }) => ({ label, gid, range, output })),
      mode: MODE,
    },
    counts: {
      articles: cleanArticles.length,
      projects: cleanProjects.length,
    },
    diff: {
      articles: articleDiff,
      projects: projectDiff,
    },
    latest: {
      articleCollectedDate: maxTextDate(cleanArticles, "기사수집일"),
      articlePublishedDate: maxTextDate(cleanArticles, "원문게재일"),
      projectUpdatedDate: maxTextDate(cleanProjects, "최근 업데이트일"),
    },
  };

  await Promise.all([
    writeJson(path.join(DATA_DIR, "articles.json"), cleanArticles),
    writeJson(path.join(DATA_DIR, "projects.json"), cleanProjects),
    writeJson(path.join(DATA_DIR, "meta.json"), meta),
  ]);

  console.log(
    `Synced ${cleanArticles.length} articles and ${cleanProjects.length} projects in ${MODE} mode. ` +
      `Articles +${articleDiff.added.length}/~${articleDiff.updated.length}/-${articleDiff.removed.length}, ` +
      `Projects +${projectDiff.added.length}/~${projectDiff.updated.length}/-${projectDiff.removed.length}.`,
  );
}

function parseMode() {
  const rawMode = process.argv.find((arg) => arg.startsWith("--mode="))?.split("=")[1] || process.env.SYNC_MODE || "quick";
  return rawMode === "reconcile" || rawMode === "full" ? "reconcile" : "quick";
}

async function fetchSheetRows(gid, range) {
  assertSupportedSourceSheet(gid, range);

  const url = new URL(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq`);
  url.searchParams.set("gid", gid);
  url.searchParams.set("headers", "1");
  url.searchParams.set("range", range);
  url.searchParams.set("tqx", "out:json");
  url.searchParams.set("cacheBust", `${Date.now()}-${gid}`);

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Google Sheets request failed: ${response.status} ${response.statusText}`);

  const text = await response.text();
  const data = parseGvizResponse(text);
  const cols = data.table.cols.map((col) => cleanValue(col.label));
  return data.table.rows.map((row) => {
    const item = {};
    cols.forEach((col, index) => {
      if (!col) return;
      const cell = row.c[index];
      item[col] = cleanValue(cell ? cell.f ?? cell.v ?? "" : "");
    });
    return item;
  });
}

function assertSupportedSourceSheet(gid, range) {
  const supported = SOURCE_SHEETS.some((sheet) => sheet.gid === gid && sheet.range === range);
  if (!supported) {
    const allowed = SOURCE_SHEETS.map((sheet) => `${sheet.label}(gid=${sheet.gid}, range=${sheet.range})`).join(", ");
    throw new Error(`Unsupported source sheet request: gid=${gid}, range=${range}. Allowed source tabs: ${allowed}.`);
  }
}

function parseGvizResponse(text) {
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}") + 1;
  if (jsonStart === -1 || jsonEnd === 0) throw new Error("Invalid Google Sheets GViz response");
  return JSON.parse(text.slice(jsonStart, jsonEnd));
}

function normalizeRows(rows, idColumn) {
  const seen = new Set();
  return rows
    .map((row) => {
      const cleanRow = {};
      Object.entries(row).forEach(([key, value]) => {
        cleanRow[cleanValue(key)] = cleanValue(value);
      });
      return cleanRow;
    })
    .filter((row) => Object.values(row).some(Boolean))
    .filter((row) => {
      const id = row[idColumn];
      if (!id) return false;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
}

function decorateArticleImportanceScore(row) {
  const label = cleanImportanceLabel(row[IMPORTANCE_LABEL_COLUMN]);
  const baseScore = parseNumber(row[IMPORTANCE_SCORE_COLUMN]);
  const aiAdjustment = parseNumber(row[AI_ADJUSTMENT_COLUMN]);
  const finalScore = baseScore + aiAdjustment;
  if (!label || !Number.isFinite(finalScore) || finalScore === 0) return row;

  return {
    ...row,
    [IMPORTANCE_DISPLAY_COLUMN]: label,
    [FINAL_IMPORTANCE_SCORE_COLUMN]: formatNumber(finalScore),
    [IMPORTANCE_LABEL_COLUMN]: `${label} (${formatNumber(finalScore)})`,
  };
}

function cleanImportanceLabel(value) {
  return cleanValue(value).replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function parseNumber(value) {
  const match = cleanValue(value).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

function mergeRows(previousRows, sheetRows, idColumn, mode) {
  if (mode === "reconcile") return sheetRows;

  const merged = new Map();
  previousRows
    .filter((row) => row?.[idColumn])
    .forEach((row) => merged.set(row[idColumn], row));
  sheetRows
    .filter((row) => row?.[idColumn])
    .forEach((row) => merged.set(row[idColumn], row));
  return [...merged.values()];
}

function assertHealthySheetRead(sheetRows, previousRows, idColumn, label, minimumRows) {
  if (sheetRows.length >= minimumRows) return;

  const previousCount = previousRows.filter((row) => row?.[idColumn]).length;
  const detail = `${label} sheet read returned ${sheetRows.length} valid rows; previous cache has ${previousCount}.`;
  if (previousCount > 0) {
    throw new Error(`${detail} Refusing to overwrite a populated cache with a suspiciously small result.`);
  }
  throw new Error(`${detail} Refusing to create an empty or incomplete cache.`);
}

function compareArticleRows(a, b) {
  return compareDatesDesc(a["기사수집일"], b["기사수집일"]) || compareDatesDesc(a["원문게재일"], b["원문게재일"]) || a[ARTICLE_ID_COLUMN].localeCompare(b[ARTICLE_ID_COLUMN]);
}

function compareProjectRows(a, b) {
  return compareDatesDesc(a["최근 업데이트일"], b["최근 업데이트일"]) || a[PROJECT_ID_COLUMN].localeCompare(b[PROJECT_ID_COLUMN]);
}

function compareDatesDesc(a, b) {
  return parseDateMillis(b) - parseDateMillis(a);
}

function parseDateMillis(value) {
  const text = cleanValue(value);
  if (!text) return 0;
  const match = text.match(/(\d{4})[.\/-]\s*(\d{1,2})[.\/-]\s*(\d{1,2})/);
  if (match) return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function maxTextDate(rows, column) {
  return rows
    .map((row) => row[column])
    .filter(Boolean)
    .sort((a, b) => compareDatesDesc(a, b))[0] || "";
}

function diffRows(previousRows, nextRows, idColumn) {
  const previous = toRowMap(previousRows, idColumn);
  const next = toRowMap(nextRows, idColumn);
  const added = [];
  const updated = [];
  const removed = [];

  next.forEach((nextHash, id) => {
    const previousHash = previous.get(id);
    if (!previousHash) {
      added.push(id);
    } else if (previousHash !== nextHash) {
      updated.push(id);
    }
  });

  previous.forEach((_, id) => {
    if (!next.has(id)) removed.push(id);
  });

  return { added, updated, removed };
}

function toRowMap(rows, idColumn) {
  return new Map(
    rows
      .filter((row) => row?.[idColumn])
      .map((row) => [row[idColumn], createHash("sha256").update(JSON.stringify(row)).digest("hex")]),
  );
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function cleanValue(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});