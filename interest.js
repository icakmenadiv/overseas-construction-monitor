(() => {
  const STORAGE_KEYS = {
    visitor: "icakInterestVisitorId",
    localVotes: "icakInterestLocalVotes",
    localDeltas: "icakInterestLocalDeltas",
  };

  const params = new URLSearchParams(window.location.search);
  const previewEnabled = params.get("interest") === "1";
  const featureEnabled = Boolean(window.INTEREST_FEATURE_ENABLED) || previewEnabled;
  const COUNT_COLUMNS = Array.isArray(window.INTEREST_COUNT_COLUMNS)
    ? window.INTEREST_COUNT_COLUMNS
    : ["관심도", "관심도 집계", "관심수", "하트수", "관심도 수치"];
  let marketRenderersWrapped = false;

  if (!featureEnabled) {
    window.InterestFeature = { enabled: false, reason: "disabled_by_feature_flag" };
    return;
  }

  window.InterestFeature = {
    enabled: true,
    enhanceAll,
    hydrate: hydrateVisibleButtons,
    enhanceMarketRowNow,
    createMarketInterestCell,
    getMarketStory: storyFromMarketRowData,
  };

  ensureVisitorId();
  wrapMarketRenderers();
  [0, 50, 200, 700].forEach((delay) => setTimeout(wrapMarketRenderers, delay));

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleEnhanceAll);
  } else {
    scheduleEnhanceAll();
  }

  function scheduleEnhanceAll() {
    [80, 400, 1000, 1800].forEach((delay) => setTimeout(enhanceAll, delay));
    document.addEventListener("click", (event) => {
      if (
        event.target.closest(".detail-button") ||
        event.target.closest(".date-preset-button") ||
        event.target.closest("button") ||
        event.target.closest("input") ||
        event.target.closest("select")
      ) {
        setTimeout(enhanceAll, 120);
        setTimeout(enhanceAll, 420);
      }
    });
    document.addEventListener("input", () => setTimeout(enhanceAll, 300));
    document.addEventListener("change", () => setTimeout(enhanceAll, 300));
  }

  function wrapMarketRenderers() {
    if (marketRenderersWrapped || typeof window.createMainRow !== "function") return;
    const originalCreateMainRow = window.createMainRow;
    window.createMainRow = function wrappedCreateMainRow(row, isExpanded) {
      const tr = originalCreateMainRow.call(this, row, isExpanded);
      return enhanceMarketRowNow(tr, row);
    };
    marketRenderersWrapped = true;
  }

  function enhanceAll() {
    wrapMarketRenderers();
    enhanceMarketTable();
    enhanceTopNewsCards();
    enhanceProjectPage();
    hydrateVisibleButtons();
  }

  function enhanceMarketRowNow(row, rowData = null) {
    if (!row || row.classList.contains("detail-row")) return row;
    [...row.children].forEach((cell) => {
      if (cell.querySelector(".detail-button") || clean(cell.getAttribute("data-label")) === "상세") cell.remove();
    });

    let cell = row.querySelector(".interest-cell");
    if (!cell) {
      const story = rowData ? storyFromMarketRowData(rowData) : storyFromMarketRowElement(row);
      if (!story.id) return row;
      cell = createMarketInterestCell(story);
      row.appendChild(cell);
      row.dataset.articleId = story.id;
      row.dataset.sheetInterestCount = String(story.sheetCount || 0);
    }

    row.dataset.interestReady = "true";
    return row;
  }

  function createMarketInterestCell(story) {
    const td = document.createElement("td");
    td.className = "interest-cell";
    td.dataset.label = "관심";
    td.appendChild(createInterestButton(story));
    return td;
  }

  function enhanceMarketTable() {
    const table = document.querySelector(".market-table");
    const tbody = document.getElementById("resultBody");
    if (!table || !tbody) return;
    const headerRow = table.querySelector("thead tr");
    if (headerRow) {
      [...headerRow.children].forEach((cell) => {
        if (clean(cell.textContent) === "상세") cell.remove();
      });
      if (!headerRow.querySelector(".interest-header-cell")) {
        const th = document.createElement("th");
        th.className = "interest-header-cell";
        th.setAttribute("aria-label", "관심");
        th.textContent = "";
        headerRow.appendChild(th);
      }
    }
    [...tbody.querySelectorAll("tr:not(.detail-row)")].forEach((row) => enhanceMarketRowNow(row));
    [...tbody.querySelectorAll("tr.detail-row")].forEach((row) => {
      const cell = row.querySelector("td");
      if (cell && headerRow) cell.colSpan = headerRow.children.length;
      if (row.dataset.interestReady === "true") return;
      const previous = previousMainRow(row);
      const story = previous ? storyFromMarketRowElement(previous) : null;
      const panel = row.querySelector(".detail-panel > div:first-child");
      if (!story?.id || !panel) return;
      const box = document.createElement("div");
      box.className = "interest-detail-box";
      box.innerHTML = `<strong>활용 가치가 높은 경우나 후속기사 추적을 원하는 경우 표시</strong>`;
      box.appendChild(createInterestButton(story));
      panel.appendChild(box);
      row.dataset.interestReady = "true";
    });
  }

  function enhanceTopNewsCards() {
    document.querySelectorAll("#topNewsCards .top-news-card").forEach((card) => {
      if (card.dataset.interestReady === "true") return;
      const story = storyFromTopNewsCard(card);
      if (!story.id) return;
      const wrap = document.createElement("div");
      wrap.className = "top-news-interest";
      wrap.appendChild(createInterestButton(story, "top-news"));
      card.appendChild(wrap);
      card.dataset.interestReady = "true";
      card.dataset.articleId = story.id;
    });
  }

  function enhanceProjectPage() {
    const projectContent = document.getElementById("projectContent");
    const projectTitle = document.getElementById("projectTitle");
    if (!projectContent || !projectTitle || projectContent.hidden) return;
    const projectStory = storyFromProjectPage();
    const toolbar = document.querySelector(".project-toolbar");
    if (toolbar && !toolbar.querySelector(".project-interest-box")) {
      const box = document.createElement("div");
      box.className = "project-interest-box";
      box.dataset.projectInterestId = projectStory.id;
      box.innerHTML = `
        <span class="project-interest-label">관심 합계</span>
        <strong class="project-interest-total" data-project-total-count>0</strong>
        <span class="project-interest-caption">활용 가치가 높은 경우나 후속기사 추적을 원하는 경우 표시</span>
      `;
      box.insertBefore(createInterestButton(projectStory, "project"), box.querySelector(".project-interest-caption"));
      toolbar.appendChild(box);
    }
    document.querySelectorAll("#projectArticles .project-article-card").forEach((card) => {
      if (card.dataset.interestReady === "true") return;
      const story = storyFromProjectArticleCard(card);
      if (!story.id) return;
      const meta = card.querySelector(".project-article-meta") || card;
      const wrap = document.createElement("span");
      wrap.className = "project-article-interest";
      wrap.dataset.projectLinkedInterest = "true";
      wrap.dataset.articleId = story.id;
      wrap.appendChild(createInterestButton(story, "project-article"));
      meta.appendChild(wrap);
      card.dataset.interestReady = "true";
      card.dataset.projectLinkedInterest = "true";
      card.dataset.articleId = story.id;
    });
    refreshProjectAggregate();
  }

  function createInterestButton(story, role = "article") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "interest-button";
    button.dataset.interestRole = role;
    button.dataset.articleId = story.id;
    button.dataset.articleTitle = story.title;
    button.dataset.articleUrl = story.url || "";
    button.dataset.sheetCount = String(story.sheetCount || 0);
    button.dataset.interestBound = "true";
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", "활용 가치가 높은 경우나 후속기사 추적을 원하는 경우 표시");
    button.innerHTML = `<span class="interest-heart" aria-hidden="true">♡</span><span class="interest-count">0</span>`;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
      toggleInterest(button, story);
    });
    applyDisplayState(button);
    return button;
  }

  function toggleInterest(button, story) {
    const nextActive = !button.classList.contains("is-active");
    setLocalVote(story.id, nextActive);
    updateButtons(story.id, nextActive, getDisplayCount(story.id, Number(button.dataset.sheetCount || story.sheetCount || 0)));
    refreshProjectAggregate();
  }

  function hydrateVisibleButtons() {
    [...document.querySelectorAll(".interest-button")].forEach((button) => {
      const id = button.dataset.articleId;
      updateButtons(id, hasLocalVote(id), getDisplayCount(id, Number(button.dataset.sheetCount || 0)));
    });
    refreshProjectAggregate();
  }

  function updateButtons(articleId, active, count) {
    document.querySelectorAll(`.interest-button[data-article-id="${cssEscape(articleId)}"]`).forEach((button) => {
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
      const heart = button.querySelector(".interest-heart");
      const countEl = button.querySelector(".interest-count");
      if (heart) heart.textContent = active ? "♥" : "♡";
      if (countEl) countEl.textContent = numberFormat(Math.max(0, Number(count || 0)));
    });
  }

  function refreshProjectAggregate() {
    const totalEl = document.querySelector("[data-project-total-count]");
    if (!totalEl) return;
    const linkedIds = [...new Set([...document.querySelectorAll("#projectArticles [data-project-linked-interest='true'], #projectArticles .project-article-card[data-project-linked-interest='true']")].map((node) => node.dataset.articleId).filter(Boolean))];
    const total = linkedIds.reduce((sum, id) => {
      const button = document.querySelector(`.interest-button[data-article-id="${cssEscape(id)}"]`);
      return sum + getDisplayCount(id, Number(button?.dataset.sheetCount || 0));
    }, 0);
    totalEl.textContent = numberFormat(total);
  }

  function storyFromMarketRowData(row) {
    const articleId = clean(row?.["기사 고유값"]);
    const title = clean(row?.["제목(한글)"] || row?.["제목(원문)"] || "제목 없음");
    const url = clean(row?.["출처링크"] || "");
    const country = clean(row?.["국가"] || "");
    const sector = clean(row?.["섹터"] || "");
    const date = clean(row?.["원문게재일"] || "");
    return { id: articleId || makeArticleId({ title, url, country, sector, date }), title, url, sheetCount: getSheetCount(row) };
  }

  function storyFromMarketRowElement(row) {
    const titleEl = row.querySelector(".market-title-cell .title-link") || row.querySelector(".market-title-cell a, .market-title-cell span");
    const title = clean(titleEl?.textContent) || "제목 없음";
    const url = clean(titleEl?.getAttribute("href") || titleEl?.href || "");
    const country = clean(row.querySelector('[data-label="국가"] .country-name')?.textContent || row.children[2]?.textContent);
    const sector = clean(row.querySelector('[data-label="섹터"]')?.textContent || row.children[3]?.textContent);
    const date = clean(row.querySelector('[data-label="원문게재일"]')?.textContent || row.children[5]?.textContent);
    return { id: row.dataset.articleId || makeArticleId({ title, url, country, sector, date }), title, url, sheetCount: Number(row.dataset.sheetInterestCount || 0) };
  }

  function storyFromTopNewsCard(card) {
    const link = card.querySelector("h3 a");
    const title = clean(link?.textContent || card.querySelector("h3")?.textContent) || "제목 없음";
    const url = clean(link?.getAttribute("href") || link?.href || "");
    const meta = clean(card.querySelector(".top-news-meta")?.textContent);
    const foot = clean(card.querySelector(".top-news-foot")?.textContent);
    return { id: card.dataset.articleId || makeArticleId({ title, url, country: meta, sector: "", date: foot }), title, url, sheetCount: Number(card.dataset.sheetInterestCount || 0) };
  }

  function storyFromProjectPage() {
    const params = new URLSearchParams(window.location.search);
    const title = clean(document.getElementById("projectTitle")?.textContent || params.get("name") || "프로젝트");
    const country = clean(params.get("country"));
    const sector = clean(params.get("sector"));
    const projectId = clean(params.get("id"));
    return { id: projectId ? `project-${projectId}` : makeProjectId({ projectId, title, country, sector }), title: `프로젝트: ${title}`, url: window.location.href, sheetCount: 0 };
  }

  function storyFromProjectArticleCard(card) {
    const title = clean(card.querySelector("h3")?.textContent) || "제목 없음";
    const link = card.querySelector(".project-article-meta a[href]");
    const url = clean(link?.getAttribute("href") || link?.href || "");
    const meta = clean(card.querySelector(".project-article-meta")?.textContent);
    return { id: card.dataset.articleId || makeArticleId({ title, url, country: meta, sector: "", date: meta }), title, url, sheetCount: Number(card.dataset.sheetInterestCount || 0) };
  }

  function getSheetCount(row) {
    for (const column of COUNT_COLUMNS) {
      const value = Number(String(row?.[column] || "").replace(/[^0-9.-]/g, ""));
      if (Number.isFinite(value) && value > 0) return value;
    }
    return 0;
  }

  function previousMainRow(row) {
    let current = row.previousElementSibling;
    while (current && current.classList.contains("detail-row")) current = current.previousElementSibling;
    return current;
  }

  function makeArticleId({ title, url, country, sector, date }) {
    const seed = clean(url) || [title, country, sector, date].map(clean).join("|");
    return `article-${hashSeed(seed)}`;
  }

  function makeProjectId({ projectId, title, country, sector }) {
    const seed = clean(projectId) || [title, country, sector].map(clean).join("|");
    return `project-${hashSeed(seed)}`;
  }

  function hashSeed(seed) {
    let hash = 2166136261;
    for (let i = 0; i < seed.length; i += 1) {
      hash ^= seed.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  }

  function applyDisplayState(button) {
    updateButtons(button.dataset.articleId, hasLocalVote(button.dataset.articleId), getDisplayCount(button.dataset.articleId, Number(button.dataset.sheetCount || 0)));
  }

  function ensureVisitorId() {
    try {
      const existing = localStorage.getItem(STORAGE_KEYS.visitor);
      if (existing) return existing;
      const random = crypto?.randomUUID ? crypto.randomUUID() : `visitor-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(STORAGE_KEYS.visitor, random);
      return random;
    } catch (error) {
      return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
  }

  function getLocalVotes() {
    return readJson(STORAGE_KEYS.localVotes, {});
  }

  function getLocalDeltas() {
    return readJson(STORAGE_KEYS.localDeltas, {});
  }

  function hasLocalVote(articleId) {
    return Boolean(getLocalVotes()[articleId]);
  }

  function setLocalVote(articleId, active) {
    const votes = getLocalVotes();
    const deltas = getLocalDeltas();
    const wasActive = Boolean(votes[articleId]);
    if (wasActive === active) return active;
    if (active) {
      votes[articleId] = true;
      deltas[articleId] = Number(deltas[articleId] || 0) + 1;
    } else {
      delete votes[articleId];
      deltas[articleId] = Number(deltas[articleId] || 0) - 1;
    }
    writeJson(STORAGE_KEYS.localVotes, votes);
    writeJson(STORAGE_KEYS.localDeltas, deltas);
    return active;
  }

  function getDisplayCount(articleId, sheetCount) {
    const delta = Number(getLocalDeltas()[articleId] || 0);
    return Math.max(0, Number(sheetCount || 0) + delta);
  }

  function readJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn("Failed to write interest localStorage:", error);
    }
  }

  function clean(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function numberFormat(value) {
    return new Intl.NumberFormat("ko-KR").format(Number(value || 0));
  }

  function cssEscape(value) {
    if (window.CSS?.escape) return CSS.escape(value);
    return String(value).replace(/"/g, "\\\"");
  }
})();