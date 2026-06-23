# 관심도 집계 Google Sheets Export용 Apps Script

이 문서는 Cloudflare D1에 저장된 관심도 집계를 Google Sheets `관심도_집계` 탭으로 주기 export하기 위한 Google Apps Script Web App 코드와 배포 절차를 정리한다.

## 대상 스프레드시트

- Spreadsheet ID: `11WmfuDj7FSk5LRvEB2CArVETZOA9NgpySLYscG223-E`
- Sheet name: `관심도_집계`
- Sheet ID: `2026062301`

## 시트 열 구조

| 열 | 이름 | 설명 |
| --- | --- | --- |
| A | 집계시각 | Worker가 export를 생성한 시각 또는 Apps Script 처리 시각 |
| B | 기사ID | 관심도 기능에서 쓰는 article id |
| C | 기사제목 | 기사 제목 |
| D | 기사URL | 기사 원문 URL |
| E | 관심수 | 서버 기준 누적 관심 수 |
| F | 내브라우저활성여부_참고 | 분석용 export에서는 보통 공란 |
| G | 최근서버반영일 | D1에서 마지막으로 반영된 시각 |
| H | 최근클릭일 | D1에서 마지막 클릭/변경 시각 |
| I | 데이터출처 | 예: `cloudflare-d1` |
| J | 비고 | 오류/보정 메모 |

## Apps Script 코드

Google Sheets에서 `확장 프로그램 > Apps Script`를 열고 아래 코드를 붙여넣는다.

```javascript
const SPREADSHEET_ID = '11WmfuDj7FSk5LRvEB2CArVETZOA9NgpySLYscG223-E';
const SHEET_NAME = '관심도_집계';
const HEADER = [
  '집계시각',
  '기사ID',
  '기사제목',
  '기사URL',
  '관심수',
  '내브라우저활성여부_참고',
  '최근서버반영일',
  '최근클릭일',
  '데이터출처',
  '비고',
];

function doGet() {
  return jsonResponse({ ok: true, service: 'interest-export', timestamp: new Date().toISOString() });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const payload = parsePayload(e);
    assertAuthorized(payload);

    const items = Array.isArray(payload.items) ? payload.items : [];
    const generatedAt = normalizeText(payload.generatedAt) || new Date().toISOString();
    const rows = buildRows(items, generatedAt);

    const sheet = getTargetSheet();
    ensureHeader(sheet);
    replaceDataRows(sheet, rows);

    return jsonResponse({
      ok: true,
      writtenRows: rows.length,
      generatedAt,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error && error.message ? error.message : error) }, 400);
  } finally {
    lock.releaseLock();
  }
}

function parsePayload(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('Missing request body');
  }
  try {
    return JSON.parse(e.postData.contents);
  } catch (error) {
    throw new Error('Invalid JSON body');
  }
}

function assertAuthorized(payload) {
  const expected = PropertiesService.getScriptProperties().getProperty('INTEREST_EXPORT_TOKEN');
  if (!expected) throw new Error('Missing INTEREST_EXPORT_TOKEN script property');
  if (!payload || payload.token !== expected) throw new Error('Unauthorized');
}

function getTargetSheet() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error(`Sheet not found: ${SHEET_NAME}`);
  return sheet;
}

function ensureHeader(sheet) {
  const current = sheet.getRange(1, 1, 1, HEADER.length).getValues()[0];
  const mismatch = HEADER.some((value, index) => current[index] !== value);
  if (mismatch) sheet.getRange(1, 1, 1, HEADER.length).setValues([HEADER]);
  sheet.setFrozenRows(1);
}

function buildRows(items, generatedAt) {
  return items
    .map((item) => {
      const count = Number(item.count || item.interestCount || item.interest_count || 0);
      return [
        generatedAt,
        normalizeText(item.articleId || item.article_id),
        normalizeText(item.articleTitle || item.article_title),
        normalizeText(item.articleUrl || item.article_url),
        Number.isFinite(count) ? Math.max(0, count) : 0,
        '',
        normalizeText(item.lastUpdatedAt || item.last_updated_at),
        normalizeText(item.lastClickedAt || item.last_clicked_at),
        normalizeText(item.source) || 'cloudflare-d1',
        normalizeText(item.note),
      ];
    })
    .filter((row) => row[1])
    .sort((a, b) => Number(b[4]) - Number(a[4]) || String(a[2]).localeCompare(String(b[2]), 'ko'));
}

function replaceDataRows(sheet, rows) {
  const maxRows = sheet.getMaxRows();
  const dataColumns = HEADER.length;
  if (maxRows > 1) {
    sheet.getRange(2, 1, maxRows - 1, dataColumns).clearContent();
  }
  if (!rows.length) return;

  const requiredRows = rows.length + 1;
  if (sheet.getMaxRows() < requiredRows) {
    sheet.insertRowsAfter(sheet.getMaxRows(), requiredRows - sheet.getMaxRows());
  }
  sheet.getRange(2, 1, rows.length, dataColumns).setValues(rows);
}

function normalizeText(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function jsonResponse(body, statusCode) {
  // Apps Script ContentService cannot set arbitrary HTTP status codes in all deployments.
  // Include the status in the body so callers can inspect it reliably.
  const output = ContentService.createTextOutput(JSON.stringify({ statusCode: statusCode || 200, ...body }));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
```

## Script Property 설정

Apps Script 왼쪽 메뉴에서 `프로젝트 설정 > 스크립트 속성`에 아래 값을 추가한다.

- 속성: `INTEREST_EXPORT_TOKEN`
- 값: Cloudflare Worker에서도 동일하게 사용할 긴 임의 문자열

예시는 문서나 GitHub에 저장하지 않는다. 실제 토큰은 Apps Script와 Cloudflare Worker secret에만 둔다.

## Web App 배포

1. Apps Script 상단 `배포 > 새 배포` 클릭
2. 유형: `웹 앱`
3. 실행 사용자: `나`
4. 액세스 권한: `모든 사용자`
5. 배포 후 생성되는 `/exec` URL을 복사

복사한 URL은 Cloudflare Worker secret 또는 환경 변수에 `GOOGLE_SHEETS_EXPORT_URL`로 저장한다.

## Worker가 보낼 JSON 형식

```json
{
  "token": "INTEREST_EXPORT_TOKEN과 같은 값",
  "generatedAt": "2026-06-23T05:30:00.000Z",
  "items": [
    {
      "articleId": "article-abc123",
      "articleTitle": "기사 제목",
      "articleUrl": "https://example.com/news/1",
      "count": 12,
      "lastUpdatedAt": "2026-06-23T05:20:00.000Z",
      "lastClickedAt": "2026-06-23T05:20:00.000Z",
      "source": "cloudflare-d1"
    }
  ]
}
```

## 운영 원칙

- Apps Script는 D1 전체 관심도 집계를 snapshot 방식으로 `관심도_집계` 탭에 덮어쓴다.
- 삭제되거나 0건이 된 기사도 D1 집계에서 빠지면 시트에서 빠지므로 분석 데이터가 최신 상태로 유지된다.
- 실시간 UI는 기존 Worker/D1을 계속 사용하고, 에이전트 분석은 `관심도_집계` 탭을 기준으로 한다.
