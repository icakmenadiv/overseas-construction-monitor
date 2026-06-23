# 관심도 집계 Google Sheets Export용 Apps Script

이 문서는 Cloudflare D1에 저장된 관심도 집계를 Google Sheets `관심도_집계` 탭으로 주기 export하기 위한 Google Apps Script Web App 코드와 배포 절차를 정리한다.

관심도는 기사뿐 아니라 프로젝트 자체에도 붙을 수 있으므로, export 스키마는 `기사`가 아니라 `관심대상` 기준으로 운영한다.

## 권장 데이터 흐름

- Cloudflare Worker/D1: 실시간 관심도 원천 저장소
- Apps Script Web App: Worker가 내보낸 JSON을 받아 Google Sheets에 기록하는 수신 endpoint
- Google Sheets `관심도_집계`: 에이전트 분석 및 운영자 확인용 snapshot

즉, Cloudflare가 Google Sheets로 `내보내고(export)`, Apps Script가 이를 `받아와서(import/receive)` 시트에 쓴다.

## 0건 관심도 처리 원칙

장기 운영 기준 권장 방식은 아래와 같다.

1. Worker export SQL은 `active = 1` 또는 집계 count가 1 이상인 대상만 내보낸다.
2. Apps Script도 방어적으로 `관심수 <= 0` 행은 시트에 쓰지 않는다.
3. Sheets는 매번 snapshot 방식으로 덮어쓴다. 따라서 기존에 관심수 1이었다가 0이 된 대상은 다음 export 때 시트에서 자동으로 사라진다.
4. Cloudflare D1에는 토글 이력/비활성 row가 남을 수 있으므로, 장기적으로는 `active = 0 AND updated_at < 90일 전` 같은 cleanup을 Worker cron에 추가하는 것이 좋다.

이렇게 하면 운영 시트는 항상 현재 관심도가 있는 대상만 보이고, D1은 사용자별 중복 방지와 이력 관리를 유지하면서도 오래된 비활성 데이터가 무한히 쌓이지 않는다.

## 대상 스프레드시트

- Spreadsheet ID: `11WmfuDj7FSk5LRvEB2CArVETZOA9NgpySLYscG223-E`
- Sheet name: `관심도_집계`
- Sheet ID: `2026062301`

## 시트 열 구조

| 열 | 이름 | 설명 |
| --- | --- | --- |
| A | 집계시각 | Worker가 export를 생성한 시각 또는 Apps Script 처리 시각 |
| B | 대상유형 | `article` 또는 `project` |
| C | 관심대상ID | 관심도 기능에서 쓰는 ID. 예: `article-...`, `project-...` |
| D | 표시명 | 기사 제목 또는 프로젝트명 |
| E | URL | 기사 원문 URL 또는 프로젝트 상세 URL |
| F | 관심수 | 서버 기준 누적 관심 수. 0 이하는 시트에 기록하지 않음 |
| G | 프로젝트고유값 | 확인 가능한 경우 프로젝트 고유값 |
| H | 기사고유값 | 확인 가능한 경우 기사 고유값 |
| I | 최근서버반영일 | D1에서 마지막으로 반영된 시각 |
| J | 최근클릭일 | D1에서 마지막 클릭/변경 시각 |
| K | 데이터출처 | 예: `cloudflare-d1` |
| L | 비고 | 오류/보정 메모 |

## Apps Script 코드

Google Sheets에서 `확장 프로그램 > Apps Script`를 열고 아래 코드를 붙여넣는다.

```javascript
const SPREADSHEET_ID = '11WmfuDj7FSk5LRvEB2CArVETZOA9NgpySLYscG223-E';
const SHEET_NAME = '관심도_집계';
const HEADER = [
  '집계시각',
  '대상유형',
  '관심대상ID',
  '표시명',
  'URL',
  '관심수',
  '프로젝트고유값',
  '기사고유값',
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
      const targetId = normalizeText(item.targetId || item.target_id || item.articleId || item.article_id);
      const count = Number(item.count || item.interestCount || item.interest_count || 0);
      const targetType = normalizeTargetType(item.targetType || item.target_type, targetId);
      return [
        generatedAt,
        targetType,
        targetId,
        normalizeText(item.displayName || item.display_name || item.articleTitle || item.article_title || item.projectTitle || item.project_title),
        normalizeText(item.url || item.articleUrl || item.article_url || item.projectUrl || item.project_url),
        Number.isFinite(count) ? Math.max(0, count) : 0,
        normalizeText(item.projectUid || item.project_uid || item.projectUniqueId || item.project_unique_id),
        normalizeText(item.articleUid || item.article_uid || item.articleUniqueId || item.article_unique_id),
        normalizeText(item.lastUpdatedAt || item.last_updated_at),
        normalizeText(item.lastClickedAt || item.last_clicked_at),
        normalizeText(item.source) || 'cloudflare-d1',
        normalizeText(item.note),
      ];
    })
    .filter((row) => row[2] && Number(row[5]) > 0)
    .sort((a, b) => {
      const typeRank = targetTypeRank(a[1]) - targetTypeRank(b[1]);
      return typeRank || Number(b[5]) - Number(a[5]) || String(a[3]).localeCompare(String(b[3]), 'ko');
    });
}

function normalizeTargetType(value, targetId) {
  const text = normalizeText(value).toLowerCase();
  if (text === 'project' || targetId.indexOf('project-') === 0) return 'project';
  if (text === 'article' || targetId.indexOf('article-') === 0) return 'article';
  return text || 'unknown';
}

function targetTypeRank(value) {
  if (value === 'project') return 0;
  if (value === 'article') return 1;
  return 9;
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
      "targetType": "article",
      "targetId": "article-abc123",
      "displayName": "기사 제목",
      "url": "https://example.com/news/1",
      "count": 12,
      "projectUid": "SAU-OILGAS-RASTANURA-GART22-PIPELINE",
      "articleUid": "ART-20260619-004574",
      "lastUpdatedAt": "2026-06-23T05:20:00.000Z",
      "lastClickedAt": "2026-06-23T05:20:00.000Z",
      "source": "cloudflare-d1"
    },
    {
      "targetType": "project",
      "targetId": "project-def456",
      "displayName": "프로젝트: Ras Tanura GART-22 Pipeline Replacement Project",
      "url": "https://icakmenadiv.github.io/overseas-construction-monitor/project.html?id=SAU-OILGAS-RASTANURA-GART22-PIPELINE",
      "count": 5,
      "projectUid": "SAU-OILGAS-RASTANURA-GART22-PIPELINE",
      "lastUpdatedAt": "2026-06-23T05:20:00.000Z",
      "lastClickedAt": "2026-06-23T05:20:00.000Z",
      "source": "cloudflare-d1"
    }
  ]
}
```

## 운영 원칙

- Apps Script는 D1 전체 관심도 집계를 snapshot 방식으로 `관심도_집계` 탭에 덮어쓴다.
- 관심수 0 이하는 시트에 기록하지 않는다.
- 삭제되거나 0건이 된 관심대상도 D1 집계에서 빠지거나 count 0으로 내려오면 다음 snapshot에서 시트에서 사라진다.
- 실시간 UI는 기존 Worker/D1을 계속 사용하고, 에이전트 분석은 `관심도_집계` 탭을 기준으로 한다.
- 분석 시 `대상유형=project`는 프로젝트 자체 관심도, `대상유형=article`은 기사 관심도로 분리 집계한다.
