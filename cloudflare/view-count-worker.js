const EVENT_TARGET_TYPE = {
  article_detail_open: "article",
  source_link_click: "article",
  project_detail_open: "project",
};

const DEFAULT_DEDUPE_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_RECENT_RETENTION_MS = 24 * 60 * 60 * 1000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return withCors(new Response(null, { status: 204 }), env);

    try {
      if (url.pathname === "/track" && request.method === "POST") {
        return withCors(await trackEvent(request, env), env);
      }
      if (url.pathname === "/counts" && request.method === "GET") {
        const auth = authorizeRead(request, env);
        if (!auth.ok) return withCors(json({ error: auth.error }, 401), env);
        return withCors(await getCounts(env), env);
      }
      if (url.pathname === "/health" && request.method === "GET") {
        return withCors(json({ ok: true }), env);
      }
      return withCors(json({ error: "not_found" }, 404), env);
    } catch (error) {
      return withCors(json({ error: "server_error", message: String(error?.message || error) }, 500), env);
    }
  },
};

async function trackEvent(request, env) {
  if (!env.DB) return json({ error: "missing_d1_binding" }, 500);

  const body = await request.json().catch(() => null);
  const eventType = clean(body?.event_type);
  const targetType = EVENT_TARGET_TYPE[eventType];
  const targetId = clean(body?.target_id);
  const sessionId = clean(body?.session_id).slice(0, 128);
  const sourceUrl = clean(body?.source_url).slice(0, 2048);
  const pagePath = clean(body?.page_path).slice(0, 512);

  if (!targetType || !targetId || !sessionId) {
    return json({ error: "invalid_payload" }, 400);
  }

  const now = Date.now();
  const dedupeWindowMs = positiveNumber(env.DEDUPE_WINDOW_MS, DEFAULT_DEDUPE_WINDOW_MS);
  const cutoff = now - dedupeWindowMs;

  const recent = await env.DB.prepare(
    `SELECT id FROM recent_view_events
     WHERE target_type = ? AND target_id = ? AND event_type = ? AND session_id = ? AND created_at >= ?
     LIMIT 1`,
  )
    .bind(targetType, targetId, eventType, sessionId, cutoff)
    .first();

  if (recent) return json({ ok: true, deduped: true });

  const isoNow = new Date(now).toISOString();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO recent_view_events
       (target_type, target_id, event_type, session_id, source_url, page_path, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(targetType, targetId, eventType, sessionId, sourceUrl, pagePath, now),
    env.DB.prepare(
      `INSERT INTO view_counts (target_type, target_id, event_type, count, updated_at)
       VALUES (?, ?, ?, 1, ?)
       ON CONFLICT(target_type, target_id, event_type)
       DO UPDATE SET count = count + 1, updated_at = excluded.updated_at`,
    ).bind(targetType, targetId, eventType, isoNow),
  ]);

  if (Math.random() < 0.02) await cleanupRecentEvents(env, now);
  return json({ ok: true, deduped: false });
}

async function getCounts(env) {
  if (!env.DB) return json({ error: "missing_d1_binding" }, 500);
  const result = await env.DB.prepare(
    `SELECT target_type, target_id, event_type, count, updated_at
     FROM view_counts
     ORDER BY target_type, target_id, event_type`,
  ).all();
  return json({
    updatedAt: new Date().toISOString(),
    rows: result.results || [],
  });
}

async function cleanupRecentEvents(env, now) {
  const retentionMs = positiveNumber(env.RECENT_RETENTION_MS, DEFAULT_RECENT_RETENTION_MS);
  await env.DB.prepare("DELETE FROM recent_view_events WHERE created_at < ?").bind(now - retentionMs).run();
}

function authorizeRead(request, env) {
  const token = clean(env.VIEW_COUNTS_READ_TOKEN);
  if (!token) return { ok: true };
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${token}` ? { ok: true } : { ok: false, error: "unauthorized" };
}

function withCors(response, env) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", clean(env.ALLOWED_ORIGIN) || "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  headers.set("Access-Control-Max-Age", "86400");
  return new Response(response.body, { status: response.status, headers });
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
