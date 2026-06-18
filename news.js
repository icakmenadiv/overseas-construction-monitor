const NEWS_CONFIG = {
  sheetId: "11WmfuDj7FSk5LRvEB2CArVETZOA9NgpySLYscG223-E",
  sheetGid: "748239675",
  latestLimit: 300,
  storyLimit: 24,
};

const i18n = {
  ko: {
    allRegions: "전체 지역",
    allCountries: "전체 국가",
    allSectors: "전체 공종",
    readMore: "기사 읽기",
    source: "원문 링크 열기",
    noSummary: "요약 내용이 없습니다.",
    noTitle: "제목 없음",
    results: (n) => `${n.toLocaleString("ko-KR")}건 표시`,
    notFound: "요청한 기사를 찾지 못했습니다.",
    loadingFailed: "뉴스 데이터를 불러오지 못했습니다.",
    facts: {
      country: "국가",
      region: "지역",
      sector: "공종",
      infoClass: "정보 분류",
      project: "프로젝트명",
      stage: "관련 단계",
      importance: "중요도",
      sourceLanguage: "출처언어",
      collected: "기사수집일",
    },
  },
  en: {
    allRegions: "All regions",
    allCountries: "All countries",
    allSectors: "All sectors",
    readMore: "Read article",
    source: "Open original source",
    noSummary: "No summary is available.",
    noTitle: "Untitled",
    results: (n) => `${n.toLocaleString("en-US")} stories`,
    notFound: "The requested article could not be found.",
    loadingFailed: "Failed to load news data.",
    facts: {
      country: "Country",
      region: "Region",
      sector: "Sector",
      infoClass: "Information type",
      project: "Project",
      stage: "Related stage",
      importance: "Importance",
      sourceLanguage: "Source language",
      collected: "Collected date",
    },
  },
};

const page = document.body.dataset.newsPage || "home";
const lang = document.body.dataset.lang || "ko";
let allStories = [];
let filteredStories = [];

document.addEventListener("DOMContentLoaded", initNewsPage);

async function initNewsPage() {
  try {
    allStories = await loadStories(lang);
    if (page === "article") {
      renderArticlePage();
      return;
    }
    setupHomePage();
  } catch (error) {
    console.error(error);
    showFailure();
  }
}

async function loadStories(currentLang) {
  const jsonUrl = `./data/public/latest-${currentLang}.json?v=${Date.now()}`;
  try {
    const response = await fetch(jsonUrl);
    if (response.ok) {
      const payload = await response.json();
      const rows = Array.isArray(payload) ? payload : payload.items || [];
      if (rows.length) return rows.map(normalizeJsonStory);
    }
  } catch (error) {
    console.info("Static JSON feed not available; falling back to Google Sheet.", error);
  }

  const sheetRows = await fetchSheetRows();
  return sheetRows.map(normalizeSheetStory).filter((story) => story.title || story.originalTitle);
}

async function fetchSheetRows() {
  const url = `https://docs.google.com/spreadsheets/d/${NEWS_CONFIG.sheetId}/gviz/tq?gid=${NEWS_CONFIG.sheetGid}&tqx=out:json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Sheet request failed: ${response.status}`);
  const text = await response.text();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}") + 1;
  const data = JSON.parse(text.slice(start, end));
  const cols = data.table.cols.map((col) => col.label || "");
  return data.table.rows.map((row) => {
    const item = {};
    cols.forEach((col, index) => {
      const cell = row.c[index];
      item[col] = cell ? cell.f || cell.v || "" : "";
    });
    return item;
  });
}

function normalizeSheetStory(row, index) {
  const id = clean(row["기사 고유값"]) || makeId(row, index);
  const titleKo = clean(row["제목(한글)"]);
  const titleEn = clean(row["제목(영문)"] || row["Title(English)"] || row["제목(원문)"]);
  const bodyKo = clean(row["내용(한글)"] || row["내용"]);
  const bodyEn = clean(row["내용(영문)"] || row["Summary(English)"] || row["내용"]);
  const dateText = clean(row["원문게재일"]);
  return {
    id,
    title: lang === "en" ? titleEn || titleKo : titleKo || titleEn,
    originalTitle: clean(row["제목(원문)"]),
    summary: lang === "en" ? bodyEn || bodyKo : bodyKo || bodyEn,
    date: normalizeDateText(dateText),
    collectedDate: normalizeDateText(clean(row["기사수집일"])),
    region: clean(row["지역"]),
    country: clean(row["국가"]),
    sector: clean(row["섹터"]),
    topic: clean(row["주제"]),
    infoClass: clean(row["정보 분류"]),
    project: clean(row["프로젝트명"]),
    stage: clean(row["관련 단계"]),
    importance: clean(row["중요도"]),
    sourceLanguage: clean(row["출처언어"]),
    sourceUrl: clean(row["출처링크"]),
    score: importanceScore(row["중요도"]),
    raw: row,
  };
}

function normalizeJsonStory(row, index) {
  return {
    id: clean(row.id) || makeId(row, index),
    title: clean(row.title),
    originalTitle: clean(row.originalTitle),
    summary: clean(row.summary || row.body),
    date: normalizeDateText(row.date || row.publishedDate),
    collectedDate: normalizeDateText(row.collectedDate),
    region: clean(row.region),
    country: clean(row.country),
    sector: clean(row.sector),
    topic: clean(row.topic),
    infoClass: clean(row.infoClass),
    project: clean(row.project),
    stage: clean(row.stage),
    importance: clean(row.importance),
    sourceLanguage: clean(row.sourceLanguage),
    sourceUrl: clean(row.sourceUrl),
    score: Number(row.score ?? importanceScore(row.importance)),
    raw: row,
  };
}

function setupHomePage() {
  allStories = sortStories(allStories).slice(0, NEWS_CONFIG.latestLimit);
  populateSelects();
  bindFilters();
  applyHomeFilters();
}

function populateSelects() {
  setOptions("regionSelect", unique("region"), i18n[lang].allRegions);
  setOptions("countrySelect", unique("country"), i18n[lang].allCountries);
  setOptions("sectorSelect", unique("sector"), i18n[lang].allSectors);
}

function setOptions(id, values, label) {
  const select = document.getElementById(id);
  if (!select) return;
  select.innerHTML = `<option value="">${escapeHtml(label)}</option>`;
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function unique(key) {
  return [...new Set(allStories.map((story) => story[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, lang === "ko" ? "ko" : "en"));
}

function bindFilters() {
  ["newsSearch", "regionSelect", "countrySelect", "sectorSelect", "sortSelect"].forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.addEventListener("input", applyHomeFilters);
  });
}

function applyHomeFilters() {
  const keyword = clean(document.getElementById("newsSearch")?.value).toLowerCase();
  const region = document.getElementById("regionSelect")?.value || "";
  const country = document.getElementById("countrySelect")?.value || "";
  const sector = document.getElementById("sectorSelect")?.value || "";
  const sort = document.getElementById("sortSelect")?.value || "importance";

  filteredStories = allStories.filter((story) => {
    const haystack = [story.title, story.originalTitle, story.summary, story.region, story.country, story.sector, story.topic, story.infoClass, story.project]
      .join(" ")
      .toLowerCase();
    return (!keyword || haystack.includes(keyword)) && (!region || story.region === region) && (!country || story.country === country) && (!sector || story.sector === sector);
  });

  filteredStories = sortStories(filteredStories, sort);
  renderHome();
}

function renderHome() {
  renderLeadStories();
  renderStoryGrid();
  renderDigests();
  const count = document.getElementById("resultCount");
  if (count) count.textContent = i18n[lang].results(filteredStories.length);
  const empty = document.getElementById("emptyState");
  if (empty) empty.hidden = filteredStories.length > 0;
}

function renderLeadStories() {
  const headline = filteredStories[0];
  const headlineCard = document.getElementById("headlineCard");
  if (headlineCard) {
    headlineCard.innerHTML = headline ? renderHeadline(headline) : `<p class="empty-state">${escapeHtml(i18n[lang].notFound)}</p>`;
  }

  const side = document.getElementById("sideLeads");
  if (side) {
    side.innerHTML = filteredStories.slice(1, 5).map(renderSideStory).join("");
  }
}

function renderHeadline(story) {
  return `
    <div class="meta-row">${renderMeta(story)}</div>
    <h2><a href="${articleUrl(story)}">${escapeHtml(story.title || i18n[lang].noTitle)}</a></h2>
    <p>${escapeHtml(excerpt(story.summary, 210))}</p>
    <a class="read-more" href="${articleUrl(story)}">${escapeHtml(i18n[lang].readMore)} →</a>
  `;
}

function renderSideStory(story) {
  return `
    <article class="side-story">
      <div class="meta-row">${renderMeta(story)}</div>
      <h3><a href="${articleUrl(story)}">${escapeHtml(story.title || i18n[lang].noTitle)}</a></h3>
      <p>${escapeHtml(excerpt(story.summary, 90))}</p>
      <a class="read-more" href="${articleUrl(story)}">${escapeHtml(i18n[lang].readMore)} →</a>
    </article>
  `;
}

function renderStoryGrid() {
  const grid = document.getElementById("storyGrid");
  if (!grid) return;
  grid.innerHTML = filteredStories.slice(0, NEWS_CONFIG.storyLimit).map((story) => `
    <article class="story-card">
      <div class="meta-row">${renderMeta(story)}</div>
      <h3><a href="${articleUrl(story)}">${escapeHtml(story.title || i18n[lang].noTitle)}</a></h3>
      <p class="summary">${escapeHtml(excerpt(story.summary, 130))}</p>
      <a class="read-more" href="${articleUrl(story)}">${escapeHtml(i18n[lang].readMore)} →</a>
    </article>
  `).join("");
}

function renderDigests() {
  renderDigest("regionDigest", groupCounts("region"));
  renderDigest("sectorDigest", groupCounts("sector"));
}

function renderDigest(id, items) {
  const box = document.getElementById(id);
  if (!box) return;
  box.innerHTML = items.slice(0, 8).map(([name, count]) => `
    <div class="digest-item"><strong>${escapeHtml(name)}</strong><span>${count}</span></div>
  `).join("");
}

function groupCounts(key) {
  const counts = new Map();
  filteredStories.forEach((story) => {
    const value = story[key];
    if (value) counts.set(value, (counts.get(value) || 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function renderArticlePage() {
  const params = new URLSearchParams(location.search);
  const id = params.get("id") || "";
  const switchLink = document.getElementById("languageSwitch");
  if (switchLink) {
    switchLink.href = lang === "ko" ? `./article-en.html?id=${encodeURIComponent(id)}` : `./article.html?id=${encodeURIComponent(id)}`;
  }

  const story = allStories.find((item) => item.id === id) || allStories.find((item) => encodeURIComponent(item.id) === id);
  const article = document.getElementById("articleView");
  if (!article) return;
  if (!story) {
    article.innerHTML = `<p class="empty-state">${escapeHtml(i18n[lang].notFound)}</p>`;
    return;
  }

  document.title = `${story.title || i18n[lang].noTitle} | ${lang === "ko" ? "해외건설시장 뉴스" : "Overseas Construction News"}`;
  article.innerHTML = `
    <p class="kicker">${escapeHtml(story.infoClass || story.topic || "Market News")}</p>
    <h1>${escapeHtml(story.title || i18n[lang].noTitle)}</h1>
    <div class="article-meta">${renderMeta(story)}</div>
    ${story.originalTitle ? `<p class="original-title">${escapeHtml(story.originalTitle)}</p>` : ""}
    <div class="article-body">${paragraphs(story.summary || i18n[lang].noSummary)}</div>
    <div class="article-facts">${renderFacts(story)}</div>
    ${story.sourceUrl ? `<a class="source-button" href="${escapeAttribute(story.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(i18n[lang].source)}</a>` : ""}
  `;
}

function renderFacts(story) {
  const labels = i18n[lang].facts;
  const facts = [
    [labels.country, story.country],
    [labels.region, story.region],
    [labels.sector, story.sector],
    [labels.infoClass, story.infoClass],
    [labels.project, story.project],
    [labels.stage, story.stage],
    [labels.importance, story.importance],
    [labels.sourceLanguage, story.sourceLanguage],
    [labels.collected, story.collectedDate],
  ].filter(([, value]) => value);
  return facts.map(([label, value]) => `<div class="fact"><span>${escapeHtml(label)}</span>${escapeHtml(value)}</div>`).join("");
}

function renderMeta(story) {
  const parts = [story.country, story.sector, story.date].filter(Boolean);
  const tags = [];
  if (story.region) tags.push(`<span class="tag">${escapeHtml(story.region)}</span>`);
  return `${tags.join("")} ${parts.map((part) => `<span>${escapeHtml(part)}</span>`).join("<span>·</span>")}`;
}

function paragraphs(text) {
  return clean(text)
    .split(/(?:\n+|(?<=\.)\s+(?=[A-Z가-힣]))/)
    .filter(Boolean)
    .map((part) => `<p>${escapeHtml(part)}</p>`)
    .join("");
}

function articleUrl(story) {
  const file = lang === "ko" ? "article.html" : "article-en.html";
  return `./${file}?id=${encodeURIComponent(story.id)}`;
}

function sortStories(stories, mode = "importance") {
  return [...stories].sort((a, b) => {
    if (mode === "latest") return dateValue(b.date) - dateValue(a.date) || b.score - a.score;
    return b.score - a.score || dateValue(b.date) - dateValue(a.date);
  });
}

function importanceScore(value) {
  const text = clean(value).toLowerCase();
  const number = text.match(/-?\d+(?:\.\d+)?/);
  if (number) return Number(number[0]);
  if (/상|높|high|important|priority/.test(text)) return 90;
  if (/중|medium|moderate/.test(text)) return 50;
  if (/하|low/.test(text)) return 10;
  return 0;
}

function dateValue(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function normalizeDateText(value) {
  const text = clean(value);
  if (!text) return "";
  const dateCtor = text.match(/^Date\((\d+),(\d+),(\d+)/);
  if (dateCtor) {
    return formatDate(new Date(Number(dateCtor[1]), Number(dateCtor[2]), Number(dateCtor[3])));
  }
  const iso = text.match(/(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text : formatDate(parsed);
}

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function makeId(row, index) {
  const base = [row["원문게재일"] || row.date || "", row["제목(한글)"] || row.title || row["제목(원문)"] || "", row["국가"] || row.country || "", index].join("-");
  let hash = 0;
  for (let i = 0; i < base.length; i += 1) hash = (hash * 31 + base.charCodeAt(i)) >>> 0;
  return `news-${hash.toString(16)}`;
}

function excerpt(text, limit) {
  const value = clean(text || i18n[lang].noSummary);
  return value.length > limit ? `${value.slice(0, limit).trim()}...` : value;
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function escapeHtml(value) {
  return clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function showFailure() {
  const message = i18n[lang].loadingFailed;
  const targets = ["headlineCard", "storyGrid", "articleView"];
  targets.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<p class="empty-state">${escapeHtml(message)}</p>`;
  });
}
