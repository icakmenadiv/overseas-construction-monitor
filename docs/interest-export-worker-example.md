# Cloudflare Worker 관심도 집계 Export 예시

이 문서는 Cloudflare Worker + D1에 저장된 관심도 데이터를 Google Apps Script Web App으로 주기 전송하는 예시이다.

현재 GitHub Pages 저장소에는 Worker 원본 코드가 포함되어 있지 않으므로, 실제 Worker 프로젝트에 아래 로직을 맞춰 추가한다.

중요: 현재 UI는 기사 관심도와 프로젝트 자체 관심도를 모두 같은 Worker에 저장한다. 따라서 export는 `article` 전용이 아니라 `관심대상(target)` 기준이어야 한다.

## 장기 운영 원칙

- UI 응답성: 브라우저에서는 클릭 즉시 localStorage로 반영한다.
- 서버 원천: Cloudflare D1은 사용자별 관심 상태의 원천이다.
- 분석 원천: Google Sheets `관심도_집계`는 D1의 현재 관심수 테이블이다.
- 평상시 sync: 마지막 export 이후 바뀐 관심대상만 `mode=incremental`로 보낸다.
- 정합성 보정: 하루 1회 `mode=full` 전체 reconcile을 실행한다.
- 0건 처리: incremental export에는 관심수 0이 된 대상도 포함해 보낸다. Apps Script가 해당 행을 삭제한다.
- D1 정리: export가 성공한 뒤 `active = 0`인 비활성 row는 매일 삭제한다.

## 필요한 Cloudflare 환경 변수/Secret

Worker에 아래 값을 설정한다.

- `GOOGLE_SHEETS_EXPORT_URL`: Apps Script Web App `/exec` URL
- `INTEREST_EXPORT_TOKEN`: Apps Script Script Property와 같은 긴 임의 문자열
- `DB`: 관심도 D1 binding

예시:

```bash
wrangler secret put GOOGLE_SHEETS_EXPORT_URL
wrangler secret put INTEREST_EXPORT_TOKEN
```

D1 binding은 기존 Worker 설정에 맞춘다.

## 필요한 D1 상태 테이블

마지막 export 시각을 저장하기 위해 상태 테이블을 추가한다.

```sql
CREATE TABLE IF NOT EXISTS export_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

최초 실행 시 상태값이 없으면 전체 export처럼 동작하거나, 충분히 과거 시각을 사용한다.

## Cron Trigger 예시

변경분은 매시간, 전체 reconcile과 cleanup은 하루 1회 실행하는 구성을 권장한다.

```toml
[triggers]
crons = ["0 * * * *", "30 18 * * *"] # UTC 기준: 매시 정각, 한국시간 03:30 전체 reconcile/cleanup
```

Cloudflare scheduled event의 cron 문자열로 분기한다.

## Worker 코드 예시

테이블명과 컬럼명은 실제 D1 구조에 맞춰 조정해야 한다.

현재 프런트엔드 `interest.js`는 `/toggle`에 아래 값을 보낸다.

- `articleId`: 실제로는 관심대상 ID. 기사면 `article-...`, 프로젝트면 `project-...`
- `articleTitle`: 기사 제목 또는 `프로젝트: ...`
- `articleUrl`: 기사 URL 또는 프로젝트 상세 URL
- `visitorId`

기존 API 이름이 article 중심이어도 export에서는 `targetType`, `targetId`, `displayName`, `url`로 변환한다.

```javascript
const EXPORT_STATE_KEY = 'interest_last_export_at';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/export-interest-to-sheets') {
      const mode = url.searchParams.get('mode') === 'full' ? 'full' : 'incremental';
      return exportInterestToSheets(env, mode);
    }

    if (url.pathname === '/cleanup-inactive-interest') {
      return cleanupInactiveInterest(env);
    }

    // 기존 /counts, /toggle 라우트는 기존 코드 유지
    return new Response('Not found', { status: 404 });
  },

  async scheduled(event, env, ctx) {
    const cron = event.cron || '';
    if (cron === '30 18 * * *') {
      ctx.waitUntil(exportInterestToSheets(env, 'full').then(() => cleanupInactiveInterest(env)));
      return;
    }
    ctx.waitUntil(exportInterestToSheets(env, 'incremental'));
  },
};

async function exportInterestToSheets(env, mode = 'incremental') {
  const startedAt = new Date().toISOString();
  const lastExportAt = mode === 'full' ? null : await getExportState(env, EXPORT_STATE_KEY);
  const items = mode === 'full'
    ? await readFullInterestSummary(env)
    : await readChangedInterestSummary(env, lastExportAt || '1970-01-01T00:00:00.000Z');

  const payload = {
    token: env.INTEREST_EXPORT_TOKEN,
    mode,
    generatedAt: startedAt,
    items,
  };

  const response = await fetch(env.GOOGLE_SHEETS_EXPORT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  if (!response.ok) {
    return new Response(`Google Sheets export failed: ${response.status} ${text}`, { status: 502 });
  }

  await setExportState(env, EXPORT_STATE_KEY, startedAt);

  return new Response(text, {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function readChangedInterestSummary(env, lastExportAt) {
  // 기존 article_id 컬럼에 article-* 및 project-* 대상 ID가 함께 저장되어 있다고 가정한다.
  // lastExportAt 이후 한 번이라도 바뀐 target만 고르고, 그 target의 현재 active count를 다시 계산한다.
  // count가 0인 row도 보내야 Apps Script가 시트에서 삭제할 수 있다.
  const result = await env.DB.prepare(`
    WITH changed AS (
      SELECT DISTINCT article_id AS targetId
      FROM interests
      WHERE updated_at > ?
    )
    SELECT
      changed.targetId AS targetId,
      MAX(interests.article_title) AS displayName,
      MAX(interests.article_url) AS url,
      SUM(CASE WHEN interests.active = 1 THEN 1 ELSE 0 END) AS count,
      MAX(interests.updated_at) AS lastUpdatedAt,
      MAX(interests.updated_at) AS lastClickedAt
    FROM changed
    LEFT JOIN interests ON interests.article_id = changed.targetId
    GROUP BY changed.targetId
    ORDER BY count DESC, lastUpdatedAt DESC
  `).bind(lastExportAt).all();

  return normalizeInterestRows(result.results || []);
}

async function readFullInterestSummary(env) {
  const result = await env.DB.prepare(`
    SELECT
      article_id AS targetId,
      MAX(article_title) AS displayName,
      MAX(article_url) AS url,
      COUNT(*) AS count,
      MAX(updated_at) AS lastUpdatedAt,
      MAX(updated_at) AS lastClickedAt
    FROM interests
    WHERE active = 1
    GROUP BY article_id
    HAVING COUNT(*) > 0
    ORDER BY count DESC, lastUpdatedAt DESC
  `).all();

  return normalizeInterestRows(result.results || []);
}

function normalizeInterestRows(rows) {
  return rows.map((row) => {
    const targetId = String(row.targetId || '');
    return {
      targetType: inferTargetType(targetId),
      targetId,
      displayName: String(row.displayName || ''),
      url: String(row.url || ''),
      count: Number(row.count || 0),
      projectUid: inferProjectUid(targetId, row.url, row.displayName),
      articleUid: inferArticleUid(targetId, row.url, row.displayName),
      lastUpdatedAt: row.lastUpdatedAt || '',
      lastClickedAt: row.lastClickedAt || '',
      source: 'cloudflare-d1',
    };
  });
}

async function cleanupInactiveInterest(env) {
  // 사용자 요청 기준: active=0 비활성 row는 매일 삭제한다.
  // exportInterestToSheets 성공 후 실행하는 것이 안전하다.
  const result = await env.DB.prepare(`
    DELETE FROM interests
    WHERE active = 0
  `).run();

  return new Response(JSON.stringify({ ok: true, result }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function getExportState(env, key) {
  const row = await env.DB.prepare(`
    SELECT value FROM export_state WHERE key = ?
  `).bind(key).first();
  return row && row.value ? String(row.value) : '';
}

async function setExportState(env, key, value) {
  const now = new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO export_state (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).bind(key, value, now).run();
}

function inferTargetType(targetId) {
  if (String(targetId || '').startsWith('project-')) return 'project';
  if (String(targetId || '').startsWith('article-')) return 'article';
  return 'unknown';
}

function inferProjectUid(targetId, url, displayName) {
  if (!String(targetId || '').startsWith('project-')) return '';
  try {
    const parsed = new URL(String(url || ''));
    return parsed.searchParams.get('id') || '';
  } catch (error) {
    return '';
  }
}

function inferArticleUid(targetId, url, displayName) {
  // 현재 프런트엔드 interest ID는 원문 URL 또는 제목 기반 hash라 기사 고유값 ART-*를 직접 복원할 수 없다.
  // Worker가 toggle payload에 articleUid를 별도 저장하도록 확장하면 여기서 내려보낼 수 있다.
  return '';
}
```

## target_id 구조로 개선할 경우

앞으로 Worker를 수정할 수 있다면 D1에는 article/project 공통 필드를 명시적으로 저장하는 것이 좋다.

```sql
CREATE TABLE IF NOT EXISTS interests (
  target_id TEXT NOT NULL,
  target_type TEXT NOT NULL, -- article | project
  display_name TEXT,
  url TEXT,
  project_uid TEXT,
  article_uid TEXT,
  visitor_id TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (target_id, visitor_id)
);
```

이 구조라면 변경분 SQL은 아래처럼 바뀐다.

```sql
WITH changed AS (
  SELECT DISTINCT target_id AS targetId
  FROM interests
  WHERE updated_at > ?
)
SELECT
  changed.targetId AS targetId,
  MAX(interests.target_type) AS targetType,
  MAX(interests.display_name) AS displayName,
  MAX(interests.url) AS url,
  SUM(CASE WHEN interests.active = 1 THEN 1 ELSE 0 END) AS count,
  MAX(interests.project_uid) AS projectUid,
  MAX(interests.article_uid) AS articleUid,
  MAX(interests.updated_at) AS lastUpdatedAt,
  MAX(interests.updated_at) AS lastClickedAt
FROM changed
LEFT JOIN interests ON interests.target_id = changed.targetId
GROUP BY changed.targetId;
```

전체 reconcile SQL은 아래처럼 바뀐다.

```sql
SELECT
  target_id AS targetId,
  target_type AS targetType,
  MAX(display_name) AS displayName,
  MAX(url) AS url,
  COUNT(*) AS count,
  MAX(project_uid) AS projectUid,
  MAX(article_uid) AS articleUid,
  MAX(updated_at) AS lastUpdatedAt,
  MAX(updated_at) AS lastClickedAt
FROM interests
WHERE active = 1
GROUP BY target_id, target_type
HAVING COUNT(*) > 0
ORDER BY count DESC, lastUpdatedAt DESC;
```

cleanup SQL은 아래처럼 매일 실행한다.

```sql
DELETE FROM interests
WHERE active = 0;
```

## 수동 테스트

Apps Script 배포 후 Worker에 임시 테스트 라우트 `/export-interest-to-sheets`를 열어두면 브라우저나 curl로 수동 실행할 수 있다.

```bash
curl 'https://<worker-domain>/export-interest-to-sheets?mode=incremental'
curl 'https://<worker-domain>/export-interest-to-sheets?mode=full'
```

성공하면 `관심도_집계` 탭에 최신 D1 집계가 기록된다.

운영 안정화 후 이 라우트는 토큰 검증을 추가하거나, cron 전용으로만 남기는 것을 권장한다.
