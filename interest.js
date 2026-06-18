(() => {
  const STORAGE_KEYS = {
    visitor: "icakInterestVisitorId",
    localVotes: "icakInterestLocalVotes",
    localCounts: "icakInterestLocalCounts",
  };

  const params = new URLSearchParams(window.location.search);
  const previewEnabled = params.get("interest") === "1";
  const featureEnabled = Boolean(window.INTEREST_FEATURE_ENABLED) || previewEnabled;
  const API_ENDPOINT = String(window.INTEREST_API_ENDPOINT || "").replace(/\/$/, "");

  if (!featureEnabled) {
    window.InterestFeature = { enabled: false, reason: "disabled_by_feature_flag" };
    return;
  }

  window.InterestFeature = { enabled: true, enhanceAll, hydrate: hydrateVisibleButtons };
  ensureVisitorId();

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
        setTimeout(enhanceAll, 220);
        setTimeout(enhanceAll, 700);
      }
    });
    document.addEventListener("input", () => setTimeout(enhanceAll, 450));
    document.addEventListener("change", () => setTimeout(enhanceAll, 450));
  }

  function enhanceAll() {
    enhanceMarketTable();
    enhanceTopNewsCards();
    enhanceProjectPage();
    hydrateVisibleButtons();
  }

  function enhanceMarketTable() {
    const table = document.querySelector(".market-table");
    const tbody = document.getElementById("resultBody");
    if (!table || !tbody) return;

    const headerRow = table.querySelector("thead tr");
    if (headerRow && !headerRow.querySelector(".interest-header-cell")) {
      const detailHeader = [...headerRow.children].find((cell) => clean(cell.textContent) === "상세") || headerRow.lastElementChild;
      const th = document.createElement("th");
      th.className = "interest-header-cell";
      th.textContent = "관심";
      headerRow.insertBefore(th, detailHeader);
    }

    [...tbody.querySelectorAll("tr:not(.detail-row)")].forEach((row) => {
      if (row.dataset.interestReady === "true") return;
      const story = storyFromMarketRowElement(row);
      if (!story.id) return;
      const detailCell = row.lastElementChild;
      const td = document.createElement("td");
      td.className = "interest-cell";
      td.dataset.label = "관심";
      td.appendChild(createInterestButton(story));
      row.insertBefore(td, detailCell);
      row.dataset.interestReady = "true";
      row.dataset.articleId = story.id;
    });

    [...tbody.querySelectorAll("tr.detail-row")].forEach((row) => {
      if (row.dataset.interestReady === "true") return;
      const previous = previousMainRow(row);
      const story = previous ? storyFromMarketRowElement(previous) : null;
      const panel = row.querySelector(".detail-panel > div:first-child");
      if (!story?.id || !panel) return;
      const box = document.createElement("div");
      box.className = "interest-detail-box";
      box.innerHTML = `<strong>후속 기사 추적 관심 표시</strong>`;
      box.appendChild(createInterestButton(story));
      const note = document.createElement("span");
      note.className = "interest-note";
      note.textContent = API_ENDPOINT
        ? "같은 브라우저에서는 다시 눌러 관심을 취소할 수 있습니다."
        : "현재는 브라우저 내 임시 저장 모드입니다. API 연결 후 전체 관심 수가 공유됩니다.";
      box.appendChild(note);
      panel.appendChild(box);
      row.dataset.interestReady = "true";
    });
  }

  function enhanceTopNewsCards() {
    document.querySelectorAll("#topNewsCards .top-news-card").forEach((card) => {
      if (card.dataset.interestReady === "true") return;
      const story = storyFromTopNewsCard(card);
      if (!story.id) return;
      card.appendChild(createInterestButton(story));
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
        <span class="project-interest-label">프로젝트 관심</span>
        <strong class="project-interest-total" data-project-total-count>0</strong>
        <span class="project-interest-caption">프로젝트 직접 관심 + 연결 기사 관심 합산</span>
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
    button.dataset.interestBound = "true";
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", "후속 기사 추적 관심 표시");
    button.innerHTML = `<span class="interest-heart" aria-hidden="true">♡</span><span class="interest-count">0</span>`;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleInterest(button, story);
    });
    applyLocalState(button);
    return button;
  }

  async function toggleInterest(button, story) {
    const nextActive = !button.classList.contains("is-active");
    setButtonLoading(story.id, true);

    try {
      if (API_ENDPOINT) {
        const payload = await apiRequest("/toggle", {
          method: "POST",
          body: {
            articleId: story.id,
            articleTitle: story.title,
            articleUrl: story.url || "",
            visitorId: getVisitorId(),
          },
        });
        setLocalVote(story.id, Boolean(payload.active));
        updateLocalCount(story.id, Number(payload.count || 0));
        updateButtons(story.id, Boolean(payload.active), Number(payload.count || 0));
      } else {
        const activeNow = setLocalVote(story.id, nextActive);
        const count = adjustLocalCount(story.id, activeNow ? 1 : -1);
        updateButtons(story.id, activeNow, count);
      }
    } catch (error) {
      console.warn("Interest update failed:", error);
      const activeNow = setLocalVote(story.id, nextActive);
      const count = adjustLocalCount(story.id, activeNow ? 1 : -1);
      updateButtons(story.id, activeNow, count);
      button.title = "관심 수 서버 저장에 실패하여 이 브라우저에만 임시 반영되었습니다.";
    } finally {
      setButtonLoading(story.id, false);
      refreshProjectAggregate();
    }
  }

  async function hydrateVisibleButtons() {
    const ids = [...new Set([...document.querySelectorAll(".interest-button")].map((button) => button.dataset.articleId).filter(Boolean))];
    if (!ids.length) return;

    if (!API_ENDPOINT) {
      ids.forEach((id) => updateButtons(id, hasLocalVote(id), getLocalCount(id)));
      refreshProjectAggregate();
      return;
    }

    try {
      const payload = await apiRequest(`/counts?ids=${encodeURIComponent(ids.join(","))}&visitorId=${encodeURIComponent(getVisitorId())}`);
      (payload.items || []).forEach((item) => {
        const id = clean(item.articleId);
        const count = Number(item.count || 0);
        const active = Boolean(item.active);
        setLocalVote(id, active);
        updateLocalCount(id, count);
        updateButtons(id, active, count);
      });
    } catch (error) {
      console.info("Interest count hydration skipped:", error);
      ids.forEach((id) => updateButtons(id, hasLocalVote(id), getLocalCount(id)));
    } finally {
      refreshProjectAggregate();
    }
  }

  async function apiRequest(path, options = {}) {
    const init = {
      method: options.method || "GET",
      headers: { "Content-Type": "application/json" },
    };
    if (options.body) init.body = JSON.stringify(options.body);
    const response = await fetch(`${API_ENDPOINT}${path}`, init);
    if (!response.ok) throw new Error(`Interest API failed: ${response.status}`);
    return response.json();
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
    const projectId = document.querySelector(".project-interest-box .interest-button")?.dataset.articleId;
    const linkedIds = [...new Set(
      [...document.querySelectorAll("#projectArticles [data-project-linked-interest='true'], #projectArticles .project-article-card[data-project-linked-interest='true']")]
        .map((node) => node.dataset.articleId)
        .filter(Boolean),
    )];
    const ids = [...new Set([projectId, ...linkedIds].filter(Boolean))];
    const total = ids.reduce((sum, id) => sum + getLocalCount(id), 0);
    totalEl.textContent = numberFormat(total);
  }

  function storyFromMarketRowElement(row) {
    const titleEl = row.querySelector(".market-title-cell .title-link") || row.querySelector(".market-title-cell a, .market-title-cell span");
    const title = clean(titleEl?.textContent) || "제목 없음";
    const url = clean(titleEl?.getAttribute("href") || titleEl?.href || "");
    const country = clean(row.querySelector('[data-label="국가"] .country-name')?.textContent || row.children[2]?.textContent);
    const sector = clean(row.querySelector('[data-label="섹터"]')?.textContent || row.children[3]?.textContent);
    const date = clean(row.querySelector('[data-label="원문게재일"]')?.textContent || row.children[5]?.textContent);
    return { id: makeArticleId({ title, url, country, sector, date }), title, url };
  }

  function storyFromTopNewsCard(card) {
    const link = card.querySelector("h3 a");
    const title = clean(link?.textContent || card.querySelector("h3")?.textContent) || "제목 없음";
    const url = clean(link?.getAttribute("href") || link?.href || "");
    const meta = clean(card.querySelector(".top-news-meta")?.textContent);
    const foot = clean(card.querySelector(".top-news-foot")?.textContent);
    return { id: makeArticleId({ title, url, country: meta, sector: "", date: foot }), title, url };
  }

  function storyFromProjectPage() {
    const params = new URLSearchParams(window.location.search);
    const title = clean(document.getElementById("projectTitle")?.textContent || params.get("name") || "프로젝트");
    const country = clean(params.get("country"));
    const sector = clean(params.get("sector"));
    const projectId = clean(params.get("id"));
    return {
      id: makeProjectId({ projectId, title, country, sector }),
      title: `프로젝트: ${title}`,
      url: window.location.href,
    };
  }

  function storyFromProjectArticleCard(card) {
    const title = clean(card.querySelector("h3")?.textContent) || "제목 없음";
    const link = card.querySelector(".project-article-meta a[href]");
    const url = clean(link?.getAttribute("href") || link?.href || "");
    const meta = clean(card.querySelector(".project-article-meta")?.textContent);
    return { id: makeArticleId({ title, url, country: meta, sector: "", date: meta }), title, url };
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

  function applyLocalState(button) {
    updateButtons(button.dataset.articleId, hasLocalVote(button.dataset.articleId), getLocalCount(button.dataset.articleId));
  }

  function setButtonLoading(articleId, isLoading) {
    document.querySelectorAll(`.interest-button[data-article-id="${cssEscape(articleId)}"]`).forEach((button) => {
      button.classList.toggle("is-loading", isLoading);
      button.disabled = isLoading;
    });
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

  function getVisitorId() {
    return localStorage.getItem(STORAGE_KEYS.visitor) || ensureVisitorId();
  }

  function getLocalVotes() {
    return readJson(STORAGE_KEYS.localVotes, {});
  }

  function getLocalCounts() {
    return readJson(STORAGE_KEYS.localCounts, {});
  }

  function hasLocalVote(articleId) {
    return Boolean(getLocalVotes()[articleId]);
  }

  function setLocalVote(articleId, active) {
    const votes = getLocalVotes();
    if (active) votes[articleId] = true;
    else delete votes[articleId];
    writeJson(STORAGE_KEYS.localVotes, votes);
    return active;
  }

  function getLocalCount(articleId) {
    return Number(getLocalCounts()[articleId] || 0);
  }

  function updateLocalCount(articleId, count) {
    const counts = getLocalCounts();
    counts[articleId] = Math.max(0, Number(count || 0));
    writeJson(STORAGE_KEYS.localCounts, counts);
    return counts[articleId];
  }

  function adjustLocalCount(articleId, delta) {
    return updateLocalCount(articleId, getLocalCount(articleId) + delta);
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
