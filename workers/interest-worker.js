// Cloudflare Worker for anonymous article interest counts.
//
// Required binding:
// - D1 database binding named DB
//
// Recommended CORS origin:
// - Set ALLOWED_ORIGIN to https://icakmenadiv.github.io

const ALLOWED_ORIGIN = "https://icakmenadiv.github.io";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return corsResponse(null, 204);

    try {
      if (url.pathname === "/counts" && request.method === "GET") {
        return corsJson(await getCounts(url, env));
      }

      if (url.pathname === "/toggle" && request.method === "POST") {
        return corsJson(await toggleInterest(request, env));
      }

      return corsJson({ error: "not_found" }, 404);
    } catch (error) {
      console.error(error);
      return corsJson({ error: "server_error" }, 500);
    }
  },
};

async function getCounts(url, env) {
  const ids = String(url.searchParams.get("ids") || "")
    .split(",")
    .map(clean)
    .filter(Boolean)
    .slice(0, 200);
  const visitorId = clean(url.searchParams.get("visitorId"));
  const visitorHash = visitorId ? await sha256(visitorId) : "";

  if (!ids.length) return { items: [] };

  const placeholders = ids.map(() => "?").join(",");
  const countRows = await env.DB.prepare(
    `SELECT article_id AS articleId, count FROM article_interest_counts WHERE article_id IN (${placeholders})`,
  )
    .bind(...ids)
    .all();

  const countMap = new Map((countRows.results || []).map((row) => [row.articleId, Number(row.count || 0)]));
  let activeSet = new Set();

  if (visitorHash) {
    const activeRows = await env.DB.prepare(
      `SELECT article_id AS articleId FROM article_interest_votes WHERE visitor_hash = ? AND active = 1 AND article_id IN (${placeholders})`,
    )
      .bind(visitorHash, ...ids)
      .all();
    activeSet = new Set((activeRows.results || []).map((row) => row.articleId));
  }

  return {
    items: ids.map((id) => ({
      articleId: id,
      count: countMap.get(id) || 0,
      active: activeSet.has(id),
    })),
  };
}

async function toggleInterest(request, env) {
  const body = await request.json();
  const articleId = clean(body.articleId).slice(0, 120);
  const articleTitle = clean(body.articleTitle).slice(0, 500);
  const articleUrl = clean(body.articleUrl).slice(0, 1000);
  const visitorId = clean(body.visitorId);

  if (!articleId || !visitorId) {
    return { error: "missing_article_or_visitor", active: false, count: 0 };
  }

  const visitorHash = await sha256(visitorId);
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO article_interest_counts (article_id, article_title, article_url, count, created_at, updated_at)
     VALUES (?, ?, ?, 0, ?, ?)
     ON CONFLICT(article_id) DO UPDATE SET
       article_title = COALESCE(NULLIF(excluded.article_title, ''), article_interest_counts.article_title),
       article_url = COALESCE(NULLIF(excluded.article_url, ''), article_interest_counts.article_url),
       updated_at = excluded.updated_at`,
  )
    .bind(articleId, articleTitle, articleUrl, now, now)
    .run();

  const existing = await env.DB.prepare(
    `SELECT active FROM article_interest_votes WHERE article_id = ? AND visitor_hash = ?`,
  )
    .bind(articleId, visitorHash)
    .first();

  const nextActive = existing ? Number(existing.active) !== 1 : true;
  const delta = nextActive ? 1 : -1;

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO article_interest_votes (article_id, visitor_hash, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(article_id, visitor_hash) DO UPDATE SET active = excluded.active, updated_at = excluded.updated_at`,
    ).bind(articleId, visitorHash, nextActive ? 1 : 0, now, now),
    env.DB.prepare(
      `UPDATE article_interest_counts SET count = MAX(0, count + ?), updated_at = ? WHERE article_id = ?`,
    ).bind(delta, now, articleId),
  ]);

  const countRow = await env.DB.prepare(
    `SELECT count FROM article_interest_counts WHERE article_id = ?`,
  )
    .bind(articleId)
    .first();

  return {
    articleId,
    active: nextActive,
    count: Number(countRow?.count || 0),
  };
}

async function sha256(value) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function corsJson(payload, status = 200) {
  return corsResponse(JSON.stringify(payload), status, {
    "Content-Type": "application/json; charset=utf-8",
  });
}

function corsResponse(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      ...headers,
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
    },
  });
}
