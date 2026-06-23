# Cloudflare Worker 관심도 집계 Export 예시

이 문서는 Cloudflare Worker + D1에 저장된 관심도 데이터를 Google Apps Script Web App으로 주기 전송하는 예시이다.

현재 GitHub Pages 저장소에는 Worker 원본 코드가 포함되어 있지 않으므로, 실제 Worker 프로젝트에 아래 로직을 맞춰 추가한다.

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
  const result = await env.DB.prepare(`
    SELECT
      article_id AS articleId,
      MAX(article_title) AS articleTitle,
      MAX(article_url) AS articleUrl,
      COUNT(*) AS count,
      MAX(updated_at) AS lastUpdatedAt,
      MAX(updated_at) AS lastClickedAt
    FROM interests
    WHERE active = 1
    GROUP BY article_id
    ORDER BY count DESC, lastUpdatedAt DESC
  `).all();

  return (result.results || []).map((row) => ({
    articleId: String(row.articleId || ''),
    articleTitle: String(row.articleTitle || ''),
    articleUrl: String(row.articleUrl || ''),
    count: Number(row.count || 0),
    lastUpdatedAt: row.lastUpdatedAt || '',
    lastClickedAt: row.lastClickedAt || '',
    source: 'cloudflare-d1',
  }));
}
```

## 테이블 구조별 SQL 조정 메모

현재 UI 코드 기준으로 Worker는 `/toggle` 호출 때 아래 값을 받는다.

- `articleId`
- `articleTitle`
- `articleUrl`
- `visitorId`

D1이 사용자별 vote row를 저장한다면 보통 아래 구조 중 하나다.

### 구조 A: active row만 저장

```sql
SELECT article_id, MAX(article_title) articleTitle, MAX(article_url) articleUrl, COUNT(*) count
FROM interests
GROUP BY article_id;
```

### 구조 B: active 플래그 저장

```sql
SELECT article_id, MAX(article_title) articleTitle, MAX(article_url) articleUrl, COUNT(*) count
FROM interests
WHERE active = 1
GROUP BY article_id;
```

### 구조 C: 집계 테이블 별도 저장

```sql
SELECT article_id, article_title, article_url, count, updated_at
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
