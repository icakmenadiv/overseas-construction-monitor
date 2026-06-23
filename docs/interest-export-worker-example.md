# Cloudflare Worker 관심도 집계 Export 예시

이 문서는 Cloudflare Worker + D1에 저장된 관심도 데이터를 Google Apps Script Web App으로 주기 전송하는 예시이다.

현재 GitHub Pages 저장소에는 Worker 원본 코드가 포함되어 있지 않으므로, 실제 Worker 프로젝트에 아래 로직을 맞춰 추가한다.

중요: 현재 UI는 기사 관심도와 프로젝트 자체 관심도를 모두 같은 Worker에 저장한다. 따라서 export는 `article` 전용이 아니라 `관심대상(target)` 기준이어야 한다.

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

## Cron Trigger 예시

`wrangler.toml`에 아래처럼 추가한다.

```toml
[triggers]
crons = ["0 * * * *"] # 매시 정각
```

하루 2회만 필요하면 예를 들어 아래처럼 둔다.

```toml
[triggers]
crons = ["0 23,8 * * *"] # UTC 기준, 한국시간 08:00/17:00
```

## Worker 코드 예시

테이블명과 컬럼명은 실제 D1 구조에 맞춰 조정해야 한다.

현재 프런트엔드 `interest.js`는 `/toggle`에 아래 값을 보낸다.

- `articleId`: 실제로는 관심대상 ID. 기사면 `article-...`, 프로젝트면 `project-...`
- `articleTitle`: 기사 제목 또는 `프로젝트: ...`
- `articleUrl`: 기사 URL 또는 프로젝트 상세 URL
- `visitorId`

기존 API 이름이 article 중심이어도 export에서는 `targetType`, `targetId`, `displayName`, `url`로 변환한다.

```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/export-interest-to-sheets') {
      return exportInterestToSheets(env);
    }

    // 기존 /counts, /toggle 라우트는 기존 코드 유지
    return new Response('Not found', { status: 404 });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(exportInterestToSheets(env));
  },
};

async function exportInterestToSheets(env) {
  const items = await readInterestSummary(env);
  const payload = {
    token: env.INTEREST_EXPORT_TOKEN,
    generatedAt: new Date().toISOString(),
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

  return new Response(text, {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function readInterestSummary(env) {
  // 아래 SQL은 예시다. 실제 D1 테이블/컬럼명에 맞게 수정한다.
  // article_id 컬럼에 article-* 및 project-* 대상 ID가 함께 저장되어 있다고 가정한다.
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
    ORDER BY count DESC, lastUpdatedAt DESC
  `).all();

  return (result.results || []).map((row) => {
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

## 더 좋은 D1 구조 권장안

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

이 구조라면 export SQL은 더 명확해진다.

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
ORDER BY count DESC, lastUpdatedAt DESC;
```

## 테이블 구조별 SQL 조정 메모

### 구조 A: 기존 article_id에 모든 대상 ID 저장

```sql
SELECT article_id targetId, MAX(article_title) displayName, MAX(article_url) url, COUNT(*) count
FROM interests
WHERE active = 1
GROUP BY article_id;
```

이 경우 `targetId` 접두사로 `article`/`project`를 구분한다.

### 구조 B: target_type/target_id 명시 저장

```sql
SELECT target_id targetId, target_type targetType, MAX(display_name) displayName, MAX(url) url, COUNT(*) count
FROM interests
WHERE active = 1
GROUP BY target_id, target_type;
```

### 구조 C: 집계 테이블 별도 저장

```sql
SELECT target_id, target_type, display_name, url, count, updated_at
FROM interest_counts
ORDER BY count DESC;
```

실제 Worker 코드의 기존 `/counts`, `/toggle` SQL을 확인한 뒤 그 테이블명과 컬럼명을 그대로 맞추는 것이 가장 안전하다.

## 수동 테스트

Apps Script 배포 후 Worker에 임시 테스트 라우트 `/export-interest-to-sheets`를 열어두면 브라우저나 curl로 수동 실행할 수 있다.

```bash
curl https://<worker-domain>/export-interest-to-sheets
```

성공하면 `관심도_집계` 탭에 최신 D1 집계가 기록된다.

운영 안정화 후 이 라우트는 토큰 검증을 추가하거나, cron 전용으로만 남기는 것을 권장한다.
