import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const OUTPUT_FILE = path.join("data", "view-counts.json");
const API_URL = process.env.VIEW_COUNTS_API_URL || process.env.CLOUDFLARE_VIEW_COUNTS_API_URL || "";
const API_TOKEN = process.env.VIEW_COUNTS_API_TOKEN || process.env.CLOUDFLARE_VIEW_COUNTS_API_TOKEN || "";
const TIMEOUT_MS = Number(process.env.VIEW_COUNTS_TIMEOUT_MS || 20000);

async function main() {
  await mkdir("data", { recursive: true });

  if (!API_URL) {
    await ensureOutputFile();
    console.log("VIEW_COUNTS_API_URL is not configured. Keeping existing view-count cache.");
    return;
  }

  const payload = await fetchCounts(API_URL, API_TOKEN);
  const normalized = normalizePayload(payload);
  await writeJson(OUTPUT_FILE, normalized);
  console.log(`Synced ${normalized.rows.length} view-count rows from Cloudflare.`);
}

async function fetchCounts(rawUrl, token) {
  const url = normalizeCountsUrl(rawUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: token ? { authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`View counts request failed: ${response.status} ${response.statusText}`);
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeCountsUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (url.pathname === "/" || !url.pathname) url.pathname = "/counts";
  return url.toString();
}

function normalizePayload(payload) {
  const rows = extractRows(payload)
    .map(normalizeRow)
    .filter(Boolean)
    .sort(compareRows);

  return {
    updatedAt: clean(payload?.updatedAt) || new Date().toISOString(),
    source: "cloudflare-d1",
    counts: groupRows(rows),
    rows,
  };
}

function extractRows(payload) {
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.counts)) return payload.counts;
  if (payload?.counts && typeof payload.counts === "object") return flattenGroupedCounts(payload.counts);
  return [];
}

function flattenGroupedCounts(grouped) {
  const rows = [];
  Object.entries(grouped).forEach(([targetType, targets]) => {
    Object.entries(targets || {}).forEach(([targetId, events]) => {
      Object.entries(events || {}).forEach(([eventType, count]) => {
        rows.push({ target_type: targetType, target_id: targetId, event_type: eventType, count });
      });
    });
  });
  return rows;
}

function normalizeRow(row) {
  const targetType = clean(row.target_type || row.targetType);
  const targetId = clean(row.target_id || row.targetId);
  const eventType = clean(row.event_type || row.eventType);
  const count = Number(row.count || 0);
  if (!targetType || !targetId || !eventType || !Number.isFinite(count) || count < 0) return null;
  return {
    targetType,
    targetId,
    eventType,
    count: Math.floor(count),
    updatedAt: clean(row.updated_at || row.updatedAt),
  };
}

function groupRows(rows) {
  return rows.reduce((grouped, row) => {
    grouped[row.targetType] ||= {};
    grouped[row.targetType][row.targetId] ||= {};
    grouped[row.targetType][row.targetId][row.eventType] = row.count;
    return grouped;
  }, {});
}

function compareRows(a, b) {
  return (
    a.targetType.localeCompare(b.targetType) ||
    a.targetId.localeCompare(b.targetId) ||
    a.eventType.localeCompare(b.eventType)
  );
}

async function ensureOutputFile() {
  try {
    await readFile(OUTPUT_FILE, "utf8");
  } catch (error) {
    await writeJson(OUTPUT_FILE, { updatedAt: "", source: "not_configured", counts: {}, rows: [] });
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
