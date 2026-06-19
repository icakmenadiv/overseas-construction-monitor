/**
 * ICAK 해외 건설시장 Daily Brief 자동 발송 스크립트
 *
 * 사용 방법
 * 1. Google Sheets에서 확장 프로그램 > Apps Script를 엽니다.
 * 2. 이 파일 전체 내용을 Code.gs에 붙여넣습니다.
 * 3. CONFIG.RECIPIENTS, CONFIG.CC, CONFIG.BCC를 실제 수신자에 맞게 수정합니다.
 * 4. sendTestDailyMarketBrief()를 먼저 실행해 테스트 메일을 확인합니다.
 * 5. 이상 없으면 createDailyMarketBriefTrigger()를 1회 실행해 매일 자동 발송 트리거를 생성합니다.
 */

const CONFIG = {
  SPREADSHEET_ID: '11WmfuDj7FSk5LRvEB2CArVETZOA9NgpySLYscG223-E',
  MARKET_SHEET_GID: 748239675,
  DASHBOARD_URL: 'https://icakmenadiv.github.io/overseas-construction-monitor/',
  RECIPIENTS: ['icak.mena.div@gmail.com'],
  CC: [],
  BCC: [],
  SENDER_NAME: 'ICAK 해외 건설시장 모니터링',
  TIMEZONE: 'Asia/Seoul',
  TOP_LIMIT: 10,
  TRIGGER_HOUR: 8,
};

const COLUMN_ALIASES = {
  id: ['기사 고유값', 'id'],
  titleKo: ['제목(한글)', '제목'],
  titleOriginal: ['제목(원문)', '원문 제목'],
  body: ['내용', '요약', '본문'],
  region: ['지역'],
  country: ['국가'],
  sector: ['섹터', '공종'],
  infoClass: ['정보 분류', '정보분류'],
  topic: ['주제', '핵심 키워드', '키워드'],
  importance: ['중요도'],
  sourceUrl: ['출처링크', '링크', 'URL'],
  publishedDate: ['원문게재일', '게재일'],
  collectedDate: ['기사수집일', '수집일', '업데이트일'],
};

function sendDailyMarketBrief() {
  const rows = loadMarketRows_();
  if (!rows.length) throw new Error('시장 모니터링 시트에서 기사 데이터를 찾지 못했습니다.');

  const latestCollectedDate = getLatestCollectedDate_(rows);
  if (!latestCollectedDate) throw new Error('기사수집일을 해석할 수 있는 행이 없습니다.');

  const targetDateKey = formatDateKey_(latestCollectedDate);
  const targetRows = rows
    .filter((row) => formatDateKey_(row._collectedDate) === targetDateKey)
    .sort(sortByImportanceThenDate_)
    .slice(0, CONFIG.TOP_LIMIT);

  if (!targetRows.length) throw new Error(`${targetDateKey} 기준 발송 대상 기사가 없습니다.`);

  const subject = `해외 건설시장 Daily Brief | ${targetDateKey} 기준 주요 기사 ${targetRows.length}건`;
  const htmlBody = buildEmailHtml_(targetRows, latestCollectedDate);
  const plainBody = buildPlainText_(targetRows, latestCollectedDate);

  MailApp.sendEmail({
    to: CONFIG.RECIPIENTS.join(','),
    cc: CONFIG.CC.join(','),
    bcc: CONFIG.BCC.join(','),
    subject,
    htmlBody,
    body: plainBody,
    name: CONFIG.SENDER_NAME,
  });
}

function sendTestDailyMarketBrief() {
  sendDailyMarketBrief();
}

function createDailyMarketBriefTrigger() {
  deleteDailyMarketBriefTriggers();
  ScriptApp.newTrigger('sendDailyMarketBrief')
    .timeBased()
    .everyDays(1)
    .atHour(CONFIG.TRIGGER_HOUR)
    .inTimezone(CONFIG.TIMEZONE)
    .create();
}

function deleteDailyMarketBriefTriggers() {
  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (trigger.getHandlerFunction() === 'sendDailyMarketBrief') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function previewDailyMarketBriefHtml() {
  const rows = loadMarketRows_();
  const latestCollectedDate = getLatestCollectedDate_(rows);
  const targetDateKey = formatDateKey_(latestCollectedDate);
  const targetRows = rows
    .filter((row) => formatDateKey_(row._collectedDate) === targetDateKey)
    .sort(sortByImportanceThenDate_)
    .slice(0, CONFIG.TOP_LIMIT);
  return buildEmailHtml_(targetRows, latestCollectedDate);
}

function loadMarketRows_() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = spreadsheet.getSheets().find((item) => item.getSheetId() === CONFIG.MARKET_SHEET_GID);
  if (!sheet) throw new Error(`GID ${CONFIG.MARKET_SHEET_GID} 시트를 찾지 못했습니다.`);

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map((value) => cleanText_(value));
  return values.slice(1)
    .map((row, index) => normalizeRow_(headers, row, index + 2))
    .filter((row) => row.titleKo || row.titleOriginal || row.body);
}

function normalizeRow_(headers, values, rowNumber) {
  const raw = {};
  headers.forEach((header, index) => {
    raw[header] = values[index];
  });

  const row = { _rowNumber: rowNumber, _raw: raw };
  Object.keys(COLUMN_ALIASES).forEach((key) => {
    row[key] = getByAliases_(raw, COLUMN_ALIASES[key]);
  });

  row.title = cleanText_(row.titleKo || row.titleOriginal || '제목 없음');
  row.body = cleanText_(row.body);
  row.topic = cleanText_(row.topic);
  row.region = cleanText_(row.region);
  row.country = cleanText_(row.country);
  row.sector = cleanText_(row.sector);
  row.infoClass = cleanText_(row.infoClass);
  row.importance = cleanText_(row.importance);
  row.sourceUrl = cleanText_(row.sourceUrl);
  row._publishedDate = parseSheetDate_(row.publishedDate);
  row._collectedDate = parseSheetDate_(row.collectedDate);
  row._importanceScore = parseImportanceScore_(row.importance);
  return row;
}

function getByAliases_(raw, aliases) {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(raw, alias)) return raw[alias];
  }
  return '';
}

function getLatestCollectedDate_(rows) {
  return rows
    .map((row) => row._collectedDate)
    .filter((date) => date && !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())[0] || null;
}

function sortByImportanceThenDate_(a, b) {
  const scoreDiff = b._importanceScore - a._importanceScore;
  if (scoreDiff) return scoreDiff;
  return (b._publishedDate?.getTime() || 0) - (a._publishedDate?.getTime() || 0);
}

function parseImportanceScore_(value) {
  const text = cleanText_(value).toLowerCase();
  const numberMatch = text.match(/-?\d+(?:\.\d+)?/);
  if (numberMatch) return Number(numberMatch[0]);
  if (/상|높|high|중요|우선/.test(text)) return 90;
  if (/중|보통|medium/.test(text)) return 50;
  if (/하|낮|low/.test(text)) return 10;
  return -1;
}

function parseSheetDate_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === '[object Date]' && !Number.isNaN(value.getTime())) return value;

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 20000 ? new Date(Math.round((value - 25569) * 86400 * 1000)) : null;
  }

  const text = cleanText_(value);
  const dateCtorMatch = text.match(/^Date\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (dateCtorMatch) return new Date(Number(dateCtorMatch[1]), Number(dateCtorMatch[2]), Number(dateCtorMatch[3]));

  const normalized = text
    .replace(/[년월]/g, '-')
    .replace(/일/g, '')
    .replace(/[./]/g, '-')
    .replace(/\s+/g, '')
    .replace(/-+/g, '-')
    .replace(/-$/, '');
  const isoMatch = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildEmailHtml_(rows, latestCollectedDate) {
  const dateKey = formatDateKey_(latestCollectedDate);
  const generatedAt = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm');
  const cards = rows.map((row, index) => buildCardHtml_(row, index + 1)).join('');

  return `
<!doctype html>
<html lang="ko">
  <body style="margin:0;padding:0;background:#f3f7fb;font-family:Arial,'Malgun Gothic','Apple SD Gothic Neo',sans-serif;color:#1f2937;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      최근 기사수집일 ${dateKey} 기준 중요도순 상위 ${rows.length}건입니다.
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f7fb;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="760" cellspacing="0" cellpadding="0" style="width:760px;max-width:94%;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #dbeafe;box-shadow:0 18px 45px rgba(15,23,42,0.10);">
            <tr>
              <td style="padding:28px 32px;background:linear-gradient(135deg,#0f4c81,#1d75bd);color:#ffffff;">
                <div style="font-size:13px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.86;">ICAK Market Monitoring</div>
                <h1 style="margin:8px 0 10px;font-size:26px;line-height:1.3;font-weight:800;">해외 건설시장 Daily Brief</h1>
                <p style="margin:0;font-size:15px;line-height:1.7;opacity:0.94;">최근 기사수집일 ${escapeHtml_(dateKey)} 기준 중요도순 상위 ${rows.length}건</p>
                <div style="margin-top:18px;">
                  <a href="${escapeAttribute_(CONFIG.DASHBOARD_URL)}" target="_blank" style="display:inline-block;background:#ffffff;color:#0f4c81;text-decoration:none;font-weight:800;border-radius:999px;padding:10px 16px;font-size:14px;">대시보드 바로가기</a>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 8px;">
                <p style="margin:0;color:#64748b;font-size:13px;line-height:1.7;">발송 기준: 기사수집일 ${escapeHtml_(dateKey)} · 생성시각 ${escapeHtml_(generatedAt)} · AI 기반 분류·요약은 참고용이며 활용 전 원문 확인이 필요합니다.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 28px;">
                ${cards}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px;background:#f8fafc;color:#64748b;font-size:12px;line-height:1.7;border-top:1px solid #e2e8f0;">
                본 메일은 Google Apps Script를 통해 자동 발송됩니다. 수신자 변경, 발송 중지, 기준 조정은 Apps Script의 CONFIG 값을 수정해 주세요.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildCardHtml_(row, rank) {
  const meta = [row.country, row.region, row.sector, row.infoClass].filter(Boolean).join(' · ') || '-';
  const title = row.title;
  const topic = row.topic || '핵심 키워드 없음';
  const body = truncate_(row.body || '요약 내용이 없습니다.', 260);
  const publishedDate = formatDateKey_(row._publishedDate) || cleanText_(row.publishedDate) || '-';
  const sourceButton = row.sourceUrl
    ? `<a href="${escapeAttribute_(row.sourceUrl)}" target="_blank" style="display:inline-block;background:#0f4c81;color:#ffffff;text-decoration:none;border-radius:10px;padding:9px 13px;font-size:13px;font-weight:800;margin-right:6px;">원문 보기</a>`
    : '';

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 14px;border:1px solid #dbeafe;border-radius:18px;background:#ffffff;overflow:hidden;">
      <tr>
        <td style="padding:18px 20px;">
          <div style="font-size:12px;color:#2563eb;font-weight:800;margin-bottom:8px;">#${rank} · 중요도 ${escapeHtml_(row.importance || String(row._importanceScore))}</div>
          <div style="font-size:12px;color:#64748b;line-height:1.6;margin-bottom:8px;">${escapeHtml_(meta)} · 원문게재일 ${escapeHtml_(publishedDate)}</div>
          <h2 style="margin:0 0 10px;font-size:18px;line-height:1.45;color:#0f172a;">${escapeHtml_(title)}</h2>
          <div style="margin:0 0 10px;font-size:13px;color:#0f4c81;font-weight:800;">${escapeHtml_(topic)}</div>
          <p style="margin:0 0 14px;font-size:14px;line-height:1.75;color:#334155;">${escapeHtml_(body)}</p>
          ${sourceButton}<a href="${escapeAttribute_(CONFIG.DASHBOARD_URL)}" target="_blank" style="display:inline-block;background:#e0f2fe;color:#075985;text-decoration:none;border-radius:10px;padding:9px 13px;font-size:13px;font-weight:800;">대시보드에서 보기</a>
        </td>
      </tr>
    </table>`;
}

function buildPlainText_(rows, latestCollectedDate) {
  const dateKey = formatDateKey_(latestCollectedDate);
  const lines = [`해외 건설시장 Daily Brief`, `기준일: ${dateKey}`, `대시보드: ${CONFIG.DASHBOARD_URL}`, ''];
  rows.forEach((row, index) => {
    lines.push(`${index + 1}. ${row.title}`);
    lines.push(`국가/섹터: ${[row.country, row.sector].filter(Boolean).join(' / ') || '-'}`);
    lines.push(`중요도: ${row.importance || row._importanceScore}`);
    if (row.sourceUrl) lines.push(`원문: ${row.sourceUrl}`);
    lines.push('');
  });
  return lines.join('\n');
}

function formatDateKey_(date) {
  if (!date || Number.isNaN(date.getTime())) return '';
  return Utilities.formatDate(date, CONFIG.TIMEZONE, 'yyyy-MM-dd');
}

function cleanText_(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function truncate_(value, maxLength) {
  const text = cleanText_(value);
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function escapeHtml_(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttribute_(value) {
  return escapeHtml_(value).replace(/`/g, '&#096;');
}
