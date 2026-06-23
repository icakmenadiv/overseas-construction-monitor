# Cloudflare Worker 관심도 집계 Export 예시

이 문서는 실제 Cloudflare Worker 코드와 D1 구조에 맞춰 Google Sheets `관심도_집계` 탭으로 관심도 데이터를 동기화하는 방법을 정리한다.

현재 D1 구조는 아래 두 테이블을 사용한다.

- `article_interest_counts`: 관심대상별 누적 count 저장
- `article_interest_votes`: 방문자별 active 상태 저장

테이블 이름은 article 중심이지만, 현재 UI에서는 프로젝트 자체 관심도도 `project-...` ID로 같은 컬럼에 저장된다. 따라서 export에서는 `article_id`를 `관심대상ID(targetId)`로 해석한다.

## 운영 정책

- 평상시: 마지막 export 이후 바뀐 관심대상만 `mode=incremental`로 Apps Script에 보낸다.
- 보정: 주 1회 `mode=full` 전체 reconcile을 실행한다.
- 0건 처리: incremental export에는 count 0이 된 대상도 포함해 보내고, Apps Script가 시트 행을 삭제한다.
- D1 정리: export 성공 후 `article_interest_votes.active = 0` row와 `article_interest_counts.count = 0` row를 매일 삭제한다.
- 수동 실행: `/export-interest-to-sheets?mode=full&token=...` 또는 `mode=incremental`로 테스트할 수 있다.

## 필요한 Secret

Cloudflare Worker의 Variables and Secrets에 아래 두 값을 Secret으로 저장한다.

- `GOOGLE_SHEETS_EXPORT_URL`: Apps Script Web App `/exec` URL
- `INTEREST_EXPORT_TOKEN`: Apps Script Script Property와 같은 값

## 필요한 D1 상태 테이블

마지막 export 시각을 저장하기 위해 D1 콘솔에서 아래 SQL을 한 번 실행한다.

```sql
CREATE TABLE IF NOT EXISTS export_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

## Cron Trigger 권장

- 매시간: incremental export
- 매일: zero cleanup
- 매주 1회: full reconcile

Cloudflare 대시보드에서 Cron Trigger를 아래처럼 추가한다.

```text
0 * * * *       매시간 incremental
20 18 * * *     매일 한국시간 03:20 zero cleanup, UTC 18:20
40 18 * * 0     매주 월요일 한국시간 03:40 full reconcile, UTC 일요일 18:40
```

Cloudflare cron의 요일은 UTC 기준이다.

## 최종 Worker 코드

아래 코드는 기존 `/counts`, `/toggle` 기능을 유지하면서 export/sync 기능을 추가한 전체 코드다.

```javascript
// Cloudflare Worker for anonymous article/project interest counts.
//
// Required binding:
// - D1 database binding named DB
//
// Required secrets:
// - GOOGLE_SHEETS_EXPORT_URL
// - INTEREST_EXPORT_TOKEN
//
// Recommended CORS origin:
// - Set ALLOWED_ORIGIN to https://icakmenadiv.github.io

const ALLOWED_ORIGIN = "https://icakmenadiv.github.io";
const EXPORT_STATE_KEY = "interest_last_export_at";
const CRON_DAILY_CLEANUP = "20 18 * * *";
const CRON_WEEKLY_FULL_RECONCILE = "40 18 * * 0";

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

      if (url.pathname === "/export-interest-to-sheets" && request.method === "GET") {
        assertAdminToken(url, env);
        const mode = url.searchParams.get("mode") === "full" ? "full" : "incremental";
        return corsJson(await exportInterestToSheets(env, mode));
      }

      if (url.pathname === "/cleanup-zero-interest" && request.method === "GET") {
        assertAdminToken(url, env);
        return corsJson(await cleanupZeroInterest(env));
      }

      return corsJson({ error: "not_found" }, 404);
    } catch (error) {
      console.error(error);
      return corsJson({ error: "server_error", message: String(error?.message || error) }, 500);
    }
  },

  async scheduled(event, env, ctx) {
    const cron = event.cron || "";

    if (cron === CRON_WEEKLY_FULL_RECONCILE) {
      ctx.waitUntil(exportInterestToSheets(env, "full"));
      return;
    }

    if (cron === CRON_DAILY_CLEANUP) {
      ctx.waitUntil(cleanupZeroInterest(env));
      return;
    }

    ctx.waitUntil(exportInterestToSheets(env, "incremental"));
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

async function exportInterestToSheets(env, mode = "incremental") {
  const startedAt = new Date().toISOString();
  const lastExportAt = mode === "full" ? "" : await getExportState(env, EXPORT_STATE_KEY);
  const items = mode === "full"
    ? await readFullInterestSummary(env)
    : await readChangedInterestSummary(env, lastExportAt || "1970-01-01T00:00:00.000Z");

  const response = await fetch(env.GOOGLE_SHEETS_EXPORT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: env.INTEREST_EXPORT_TOKEN,
      mode,
      generatedAt: startedAt,
      items,
    }),
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    payload = { raw: text };
  }

  if (!response.ok || payload?.ok === false) {
    throw new Error(`Google Sheets export failed: ${response.status} ${text}`);
  }

  await setExportState(env, EXPORT_STATE_KEY, startedAt);

  return {
    ok: true,
    mode,
    exportedItems: items.length,
    generatedAt: startedAt,
    sheetsResponse: payload,
  };
}

async function readChangedInterestSummary(env, lastExportAt) {
  const result = await env.DB.prepare(
    `SELECT
       article_id AS targetId,
       article_title AS displayName,
       article_url AS url,
       count AS count,
       updated_at AS lastUpdatedAt,
       updated_at AS lastClickedAt
     FROM article_interest_counts
     WHERE updated_at > ?
     ORDER BY count DESC, updated_at DESC`,
  )
    .bind(lastExportAt)
    .all();

  return normalizeInterestRows(result.results || []);
}

async function readFullInterestSummary(env) {
  const result = await env.DB.prepare(
    `SELECT
       article_id AS targetId,
       article_title AS displayName,
       article_url AS url,
       count AS count,
       updated_at AS lastUpdatedAt,
       updated_at AS lastClickedAt
     FROM article_interest_counts
     WHERE count > 0
     ORDER BY count DESC, updated_at DESC`,
  ).all();

  return normalizeInterestRows(result.results || []);
}

function normalizeInterestRows(rows) {
  return rows.map((row) => {
    const targetId = String(row.targetId || "");
    const url = String(row.url || "");
    return {
      targetType: inferTargetType(targetId),
      targetId,
      displayName: String(row.displayName || ""),
      url,
      count: Number(row.count || 0),
      projectUid: inferProjectUid(targetId, url),
      articleUid: "",
      lastUpdatedAt: row.lastUpdatedAt || "",
      lastClickedAt: row.lastClickedAt || "",
      source: "cloudflare-d1",
    };
  });
}

async function cleanupZeroInterest(env) {
  await env.DB.prepare(`DELETE FROM article_interest_votes WHERE active = 0`).run();
  await env.DB.prepare(`DELETE FROM article_interest_counts WHERE count <= 0`).run();
  return { ok: true, cleanedAt: new Date().toISOString() };
}

async function getExportState(env, key) {
  const row = await env.DB.prepare(
    `SELECT value FROM export_state WHERE key = ?`,
  )
    .bind(key)
    .first();
  return row?.value ? String(row.value) : "";
}

async function setExportState(env, key, value) {
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO export_state (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  )
    .bind(key, value, now)
    .run();
}

function assertAdminToken(url, env) {
  const token = clean(url.searchParams.get("token"));
  if (!env.INTEREST_EXPORT_TOKEN || token !== env.INTEREST_EXPORT_TOKEN) {
    throw new Error("unauthorized_export_request");
  }
}

function inferTargetType(targetId) {
  if (String(targetId || "").startsWith("project-")) return "project";
  if (String(targetId || "").startsWith("article-")) return "article";
  return "unknown";
}

function inferProjectUid(targetId, url) {
  if (!String(targetId || "").startsWith("project-")) return "";
  try {
    const parsed = new URL(String(url || ""));
    return parsed.searchParams.get("id") || "";
  } catch (error) {
    return "";
  }
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
    },
  });
}
```
