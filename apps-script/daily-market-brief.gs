/**
 * ICAK 해외 건설시장 Daily Brief 자동 발송 스크립트
 *
 * 반영 기준
 * - 수신자별 선호 지역 기사만 발송
 * - 원문게재일 기준 최근 5일 기사 중 중요도 수치값 상위 30건 발송
 * - 이전 정식 발송 메일에서 해당 수신자에게 보낸 기사는 제외
 * - 테스트 발송 메일 제목에는 [테스트발송] 표시
 * - 수신자 시트 E열/신청 구분이 수신거부인 이메일은 수신자에서 제외하고 해당 이메일 포함 행을 삭제
 * - 중복 이메일은 최신 등록 1건만 사용
 */

const CONFIG = {
  SPREADSHEET_ID: '11WmfuDj7FSk5LRvEB2CArVETZOA9NgpySLYscG223-E',
  MARKET_SHEET_GID: 748239675,
  RECIPIENT_SPREADSHEET_ID: '1de_e5MEID7aBiyUuGorO_mNLil4tNDF_vRT_0i-QMGk',
  RECIPIENT_SHEET_GID: 1185967773,
  LOG_SHEET_NAME: '발송로그',
  DASHBOARD_URL: 'https://icakmenadiv.github.io/overseas-construction-monitor/',
  FALLBACK_RECIPIENTS: ['icak.mena.div@gmail.com'],
  SENDER_NAME: 'ICAK 해외 건설시장 모니터링',
  TIMEZONE: 'Asia/Seoul',
  TOP_LIMIT: 30,
  RECENT_DAYS_BY_PUBLISHED_DATE: 5,
  TRIGGER_HOUR: 8,
  MAX_BCC_PER_EMAIL: 80,
  TEST_ONLY_FALLBACK_RECIPIENTS: false,
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
  importance: ['중요도', '중요도 수치값'],
  sourceUrl: ['출처링크', '링크', 'URL'],
  publishedDate: ['원문게재일', '게재일'],
  collectedDate: ['기사수집일', '수집일', '업데이트일'],
};

function sendDailyMarketBrief() {
  sendMarketBrief_({ isTest: false });
}

function sendTestDailyMarketBrief() {
  sendMarketBrief_({ isTest: true });
}

function sendMarketBrief_({ isTest }) {
  const recipients = loadMailRecipients_();
  const recipientGroups = buildRecipientGroups_(recipients, isTest);
  if (!recipientGroups.length) throw new Error('유효한 수신자 그룹을 찾지 못했습니다.');

  const rows = loadMarketRows_();
  if (!rows.length) throw new Error('시장 모니터링 시트에서 기사 데이터를 찾지 못했습니다.');

  const latestPublishedDate = getLatestPublishedDate_(rows);
  if (!latestPublishedDate) throw new Error('원문게재일을 해석할 수 있는 행이 없습니다.');

  const range = getRecentPublishedDateRange_(latestPublishedDate);
  const sentMap = getSentArticleMap_();
  let sentEmailCount = 0;

  recipientGroups.forEach((group) => {
    const groupRows = rows
      .filter((row) => isWithinDateRange_(row._publishedDate, range.start, range.end))
      .filter((row) => isRegionMatched_(row.region, group.regions))
      .filter((row) => isTest || !wasSentToAllRecipients_(row, group.recipients, sentMap))
      .sort(sortByImportanceThenDate_)
      .slice(0, CONFIG.TOP_LIMIT);

    if (!groupRows.length) return;

    const regionLabel = group.regions.length ? group.regions.join(', ') : '전체 지역';
    const baseSubject = `해외 건설시장 Daily Brief | ${regionLabel} 최근 ${CONFIG.RECENT_DAYS_BY_PUBLISHED_DATE}일 주요 기사 ${groupRows.length}건`;
    const subject = isTest ? `[테스트발송] ${baseSubject}` : baseSubject;
    const htmlBody = buildEmailHtml_(groupRows, range, group, isTest);
    const plainBody = buildPlainText_(groupRows, range, group, isTest);

    const chunks = chunkArray_(group.recipients, CONFIG.MAX_BCC_PER_EMAIL);
    chunks.forEach((chunk) => {
      MailApp.sendEmail({
        to: CONFIG.FALLBACK_RECIPIENTS[0],
        bcc: chunk.map((recipient) => recipient.email).join(','),
        subject,
        htmlBody,
        body: plainBody,
        name: CONFIG.SENDER_NAME,
      });
      sentEmailCount += 1;
      if (!isTest) recordSentArticles_(groupRows, chunk, range, subject, regionLabel);
    });
  });

  if (!sentEmailCount) {
    throw new Error(`${formatDateKey_(range.start)}~${formatDateKey_(range.end)} 원문게재일 기준 신규 발송 대상 기사가 없습니다.`);
  }
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
    if (trigger.getHandlerFunction() === 'sendDailyMarketBrief') ScriptApp.deleteTrigger(trigger);
  });
}

function previewDailyMarketBriefHtml() {
  const recipients = loadMailRecipients_();
  const groups = buildRecipientGroups_(recipients, true);
  const rows = loadMarketRows_();
  const latestPublishedDate = getLatestPublishedDate_(rows);
  const range = getRecentPublishedDateRange_(latestPublishedDate);
  const group = groups[0];
  const targetRows = rows
    .filter((row) => isWithinDateRange_(row._publishedDate, range.start, range.end))
    .filter((row) => isRegionMatched_(row.region, group.regions))
    .sort(sortByImportanceThenDate_)
    .slice(0, CONFIG.TOP_LIMIT);
  return buildEmailHtml_(targetRows, range, group, true);
}

function resetSentArticleHistory() {
  PropertiesService.getScriptProperties().deleteProperty('SENT_ARTICLE_MAP');
  PropertiesService.getScriptProperties().deleteProperty('SENT_ARTICLE_KEYS');
}

function loadMailRecipients_() {
  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.RECIPIENT_SPREADSHEET_ID);
    const sheet = spreadsheet.getSheets().find((item) => item.getSheetId() === CONFIG.RECIPIENT_SHEET_GID);
    if (!sheet) throw new Error(`GID ${CONFIG.RECIPIENT_SHEET_GID} 수신자 시트를 찾지 못했습니다.`);

    cleanupUnsubscribedRows_(sheet);

    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return fallbackRecipientObjects_();

    const headers = values[0].map((value) => normalizeHeader_(value));
    const emailIndex = findHeaderIndex_(headers, ['이메일주소', '이메일', 'email', '메일', 'mail']);
    const nameIndex = findHeaderIndex_(headers, ['성명', '이름', 'name']);
    const orgIndex = findHeaderIndex_(headers, ['소속', '기관', 'org', 'organization']);
    const regionIndex = findHeaderIndex_(headers, ['선호지역', '희망지역', '지역']);
    const regionOnlyIndex = findHeaderIndex_(headers, ['선호지역기사만수신을원하는지여부', '선호지역기사만수신', '지역기사만수신']);

    if (emailIndex < 0) return fallbackRecipientObjects_();

    const latestByEmail = new Map();
    values.slice(1).forEach((row, zeroBasedIndex) => {
      extractEmails_(row[emailIndex]).forEach((email) => {
        latestByEmail.set(email, {
          email,
          name: cleanText_(nameIndex >= 0 ? row[nameIndex] : ''),
          org: cleanText_(orgIndex >= 0 ? row[orgIndex] : ''),
          regions: parseRegions_(regionIndex >= 0 ? row[regionIndex] : ''),
          regionOnly: cleanText_(regionOnlyIndex >= 0 ? row[regionOnlyIndex] : '').includes('기사만'),
          rowNumber: zeroBasedIndex + 2,
        });
      });
    });

    const recipients = [...latestByEmail.values()].filter((recipient) => recipient.email);
    return recipients.length ? recipients : fallbackRecipientObjects_();
  } catch (error) {
    console.warn('수신자 시트 읽기 실패. FALLBACK_RECIPIENTS를 사용합니다:', error);
    return fallbackRecipientObjects_();
  }
}

function cleanupUnsubscribedRows_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return;

  const headers = values[0].map((value) => normalizeHeader_(value));
  const emailIndex = findHeaderIndex_(headers, ['이메일주소', '이메일', 'email', '메일', 'mail']);
  const statusIndex = findHeaderIndex_(headers, ['신청구분', '신청', '구분', 'status']);
  const effectiveStatusIndex = statusIndex >= 0 ? statusIndex : 4;
  if (emailIndex < 0) return;

  const unsubscribeEmails = new Set();
  values.slice(1).forEach((row) => {
    const statusText = cleanText_(row[effectiveStatusIndex]);
    if (statusText.includes('수신거부')) extractEmails_(row[emailIndex]).forEach((email) => unsubscribeEmails.add(email));
  });
  if (!unsubscribeEmails.size) return;

  for (let r = values.length - 1; r >= 1; r -= 1) {
    const rowEmails = extractEmails_(values[r][emailIndex]);
    if (rowEmails.some((email) => unsubscribeEmails.has(email))) sheet.deleteRow(r + 1);
  }
}

function buildRecipientGroups_(recipients, isTest) {
  const activeRecipients = isTest && CONFIG.TEST_ONLY_FALLBACK_RECIPIENTS ? fallbackRecipientObjects_() : recipients;
  const groups = new Map();

  activeRecipients.forEach((recipient) => {
    const regions = recipient.regions.length ? recipient.regions : [];
    const key = regions.length ? regions.slice().sort().join('|') : 'ALL';
    if (!groups.has(key)) groups.set(key, { key, regions, recipients: [] });
    groups.get(key).recipients.push(recipient);
  });

  return [...groups.values()];
}

function fallbackRecipientObjects_() {
  return uniqueEmails_(CONFIG.FALLBACK_RECIPIENTS || []).map((email) => ({ email, name: '', org: '', regions: [], regionOnly: false }));
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
  headers.forEach((header, index) => { raw[header] = values[index]; });

  const row = { _rowNumber: rowNumber, _raw: raw };
  Object.keys(COLUMN_ALIASES).forEach((key) => { row[key] = getByAliases_(raw, COLUMN_ALIASES[key]); });

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

function getLatestPublishedDate_(rows) {
  return rows.map((row) => row._publishedDate).filter((date) => date && !Number.isNaN(date.getTime())).sort((a, b) => b.getTime() - a.getTime())[0] || null;
}

function getRecentPublishedDateRange_(latestDate) {
  const end = new Date(latestDate.getFullYear(), latestDate.getMonth(), latestDate.getDate(), 23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - CONFIG.RECENT_DAYS_BY_PUBLISHED_DATE + 1);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

function isWithinDateRange_(date, start, end) {
  return date && !Number.isNaN(date.getTime()) && date >= start && date <= end;
}

function isRegionMatched_(articleRegion, preferredRegions) {
  if (!preferredRegions.length) return true;
  const normalizedArticleRegion = normalizeRegion_(articleRegion);
  return preferredRegions.some((region) => normalizedArticleRegion === region || normalizedArticleRegion.includes(region) || region.includes(normalizedArticleRegion));
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

function getArticleKey_(row) {
  return cleanText_(row.id) || cleanText_(row.sourceUrl) || `${row.title}|${formatDateKey_(row._publishedDate)}`;
}

function wasSentToAllRecipients_(row, recipients, sentMap) {
  const articleKey = getArticleKey_(row);
  return recipients.every((recipient) => Boolean(sentMap[makeRecipientArticleKey_(recipient.email, articleKey)]));
}

function makeRecipientArticleKey_(email, articleKey) {
  return `${email}::${articleKey}`;
}

function getSentArticleMap_() {
  const stored = PropertiesService.getScriptProperties().getProperty('SENT_ARTICLE_MAP') || '{}';
  try {
    return JSON.parse(stored);
  } catch (error) {
    return {};
  }
}

function recordSentArticles_(rows, recipients, range, subject, regionLabel) {
  const sentMap = getSentArticleMap_();
  rows.forEach((row) => {
    const articleKey = getArticleKey_(row);
    recipients.forEach((recipient) => { sentMap[makeRecipientArticleKey_(recipient.email, articleKey)] = new Date().toISOString(); });
  });
  const entries = Object.entries(sentMap).slice(-5000);
  PropertiesService.getScriptProperties().setProperty('SENT_ARTICLE_MAP', JSON.stringify(Object.fromEntries(entries)));

  const spreadsheet = SpreadsheetApp.openById(CONFIG.RECIPIENT_SPREADSHEET_ID);
  let logSheet = spreadsheet.getSheetByName(CONFIG.LOG_SHEET_NAME);
  if (!logSheet) logSheet = spreadsheet.insertSheet(CONFIG.LOG_SHEET_NAME);
  if (logSheet.getLastRow() === 0) {
    logSheet.appendRow(['발송시각', '제목', '지역그룹', '기준시작일', '기준종료일', '발송건수', '수신자수', '수신자', '기사고유값', '기사제목']);
  }

  const now = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  const recipientEmails = recipients.map((recipient) => recipient.email).join(', ');
  rows.forEach((row) => {
    logSheet.appendRow([now, subject, regionLabel, formatDateKey_(range.start), formatDateKey_(range.end), rows.length, recipients.length, recipientEmails, getArticleKey_(row), row.title]);
  });
}

function parseSheetDate_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === '[object Date]' && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value > 20000 ? new Date(Math.round((value - 25569) * 86400 * 1000)) : null;

  const text = cleanText_(value);
  const dateCtorMatch = text.match(/^Date\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (dateCtorMatch) return new Date(Number(dateCtorMatch[1]), Number(dateCtorMatch[2]), Number(dateCtorMatch[3]));

  const normalized = text.replace(/[년월]/g, '-').replace(/일/g, '').replace(/[./]/g, '-').replace(/\s+/g, '').replace(/-+/g, '-').replace(/-$/, '');
  const isoMatch = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildEmailHtml_(rows, range, group, isTest) {
  const startKey = formatDateKey_(range.start);
  const endKey = formatDateKey_(range.end);
  const generatedAt = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm');
  const cards = rows.map((row, index) => buildCardHtml_(row, index + 1)).join('');
  const recipientCount = group ? group.recipients.length : 0;
  const regionLabel = group && group.regions.length ? group.regions.join(', ') : '전체 지역';
  const testBadge = isTest ? '<span style="display:inline-block;background:#fef3c7;color:#92400e;border-radius:999px;padding:5px 10px;font-size:12px;font-weight:800;margin-bottom:10px;">테스트발송</span>' : '';

  return `
<!doctype html>
<html lang="ko">
  <body style="margin:0;padding:0;background:#f3f7fb;font-family:Arial,'Malgun Gothic','Apple SD Gothic Neo',sans-serif;color:#1f2937;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${regionLabel} 원문게재일 ${startKey}~${endKey} 기준 주요 기사 ${rows.length}건입니다.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f7fb;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="760" cellspacing="0" cellpadding="0" style="width:760px;max-width:94%;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #dbeafe;box-shadow:0 18px 45px rgba(15,23,42,0.10);">
          <tr><td style="padding:28px 32px;background:linear-gradient(135deg,#0f4c81,#1d75bd);color:#ffffff;">
            ${testBadge}
            <div style="font-size:13px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.86;">ICAK Market Monitoring</div>
            <h1 style="margin:8px 0 10px;font-size:26px;line-height:1.3;font-weight:800;">해외 건설시장 Daily Brief</h1>
            <p style="margin:0;font-size:15px;line-height:1.7;opacity:0.94;">${escapeHtml_(regionLabel)} · 원문게재일 ${escapeHtml_(startKey)}~${escapeHtml_(endKey)} 주요 기사 ${rows.length}건</p>
            <div style="margin-top:18px;"><a href="${escapeAttribute_(CONFIG.DASHBOARD_URL)}" target="_blank" style="display:inline-block;background:#ffffff;color:#0f4c81;text-decoration:none;font-weight:800;border-radius:999px;padding:10px 16px;font-size:14px;">대시보드 바로가기</a></div>
          </td></tr>
          <tr><td style="padding:24px 32px 8px;"><p style="margin:0;color:#64748b;font-size:13px;line-height:1.7;">발송 기준: 선호지역 ${escapeHtml_(regionLabel)} · 원문게재일 최근 ${CONFIG.RECENT_DAYS_BY_PUBLISHED_DATE}일 · 생성시각 ${escapeHtml_(generatedAt)} · 수신자 ${recipientCount}명 · 검색, 번역 및 분류, 요약에 AI가 활용되어 오류가 있을 수 있습니다.</p></td></tr>
          <tr><td style="padding:8px 32px 28px;">${cards}</td></tr>
          <tr><td style="padding:18px 32px;background:#f8fafc;color:#64748b;font-size:12px;line-height:1.7;border-top:1px solid #e2e8f0;">본 메일은 Google Apps Script를 통해 자동 발송됩니다. 수신자는 선호지역별로 분리해 발송됩니다.</td></tr>
        </table>
      </td></tr>
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
  const sourceButton = row.sourceUrl ? `<a href="${escapeAttribute_(row.sourceUrl)}" target="_blank" style="display:inline-block;background:#0f4c81;color:#ffffff;text-decoration:none;border-radius:10px;padding:9px 13px;font-size:13px;font-weight:800;margin-right:6px;">원문 보기</a>` : '';

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 14px;border:1px solid #dbeafe;border-radius:18px;background:#ffffff;overflow:hidden;">
      <tr><td style="padding:18px 20px;">
        <div style="font-size:12px;color:#2563eb;font-weight:800;margin-bottom:8px;">#${rank}</div>
        <div style="font-size:12px;color:#64748b;line-height:1.6;margin-bottom:8px;">${escapeHtml_(meta)} · 원문게재일 ${escapeHtml_(publishedDate)}</div>
        <h2 style="margin:0 0 10px;font-size:18px;line-height:1.45;color:#0f172a;">${escapeHtml_(title)}</h2>
        <div style="margin:0 0 10px;font-size:13px;color:#0f4c81;font-weight:800;">${escapeHtml_(topic)}</div>
        <p style="margin:0 0 14px;font-size:14px;line-height:1.75;color:#334155;">${escapeHtml_(body)}</p>
        ${sourceButton}<a href="${escapeAttribute_(CONFIG.DASHBOARD_URL)}" target="_blank" style="display:inline-block;background:#e0f2fe;color:#075985;text-decoration:none;border-radius:10px;padding:9px 13px;font-size:13px;font-weight:800;">대시보드에서 보기</a>
      </td></tr>
    </table>`;
}

function buildPlainText_(rows, range, group, isTest) {
  const regionLabel = group && group.regions.length ? group.regions.join(', ') : '전체 지역';
  const lines = [`${isTest ? '[테스트발송] ' : ''}해외 건설시장 Daily Brief`, `선호지역: ${regionLabel}`, `기준: 원문게재일 ${formatDateKey_(range.start)}~${formatDateKey_(range.end)}`, `대시보드: ${CONFIG.DASHBOARD_URL}`, ''];
  rows.forEach((row, index) => {
    lines.push(`${index + 1}. ${row.title}`);
    lines.push(`국가/지역/섹터: ${[row.country, row.region, row.sector].filter(Boolean).join(' / ') || '-'}`);
    if (row.sourceUrl) lines.push(`원문: ${row.sourceUrl}`);
    lines.push('');
  });
  return lines.join('\n');
}

function parseRegions_(value) {
  return cleanText_(value)
    .split(/[,.،，\/|·ㆍ;；\n]+/)
    .map((item) => normalizeRegion_(item))
    .filter(Boolean);
}

function normalizeRegion_(value) {
  return cleanText_(value).replace(/\s+/g, '').replace(/,/g, '');
}

function findHeaderIndex_(headers, candidates) {
  return headers.findIndex((header) => candidates.includes(header));
}

function extractEmails_(value) {
  const text = cleanText_(value);
  if (!text) return [];
  const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  return matches ? matches.map((email) => email.toLowerCase()) : [];
}

function uniqueEmails_(emails) {
  return [...new Set((emails || []).map((email) => cleanText_(email).toLowerCase()).filter(Boolean))];
}

function normalizeHeader_(value) {
  return cleanText_(value).toLowerCase().replace(/\s+/g, '').replace(/[()\[\]{}]/g, '');
}

function chunkArray_(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
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
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function escapeAttribute_(value) {
  return escapeHtml_(value).replace(/`/g, '&#096;');
}
