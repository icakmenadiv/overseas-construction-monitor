(() => {
  const STORAGE_KEYS = {
    visitor: "icakInterestVisitorId",
    localVotes: "icakInterestLocalVotes",
    localCounts: "icakInterestLocalCounts",
  };

  const API_ENDPOINT = String(window.INTEREST_API_ENDPOINT || "").replace(/\/$/, "");
  const observerOptions = { childList: true, subtree: true };
  const hydrationQueue = new Set();
  let hydrationTimer = null;
  let projectAggregate = null;

  document.addEventListener("DOMContentLoaded", initInterestButtons);

  function initInterestButtons() {
    ensureVisitorId();
    installTableHeader();
    enhanceCurrentRows();
    enhanceTopNewsCards();
    enhanceProjectPage();

    const resultBody = document.getElementById("resultBody");
    if (resultBody) {
      new MutationObserver(() => {
        installTableHeader();
        enhanceCurrentRows();
      }).observe(resultBody, observerOptions);
    }

    const topNewsCards = document.getElementById("topNewsCards");
    if (topNewsCards) {
      new MutationObserver(enhanceTopNewsCards).observe(topNewsCards, observerOptions);
    }

    const projectContent = document.getElementById("projectContent");
    if (projectContent) {
      new MutationObserver(enhanceProjectPage).observe(projectContent, observerOptions);
    }
  }

  function installTableHeader() {
    const headerRow = document.querySelector(".market-table thead tr");
    if (!headerRow || headerRow.querySelector(".interest-header-cell")) return;
    const detailHeader = [...headerRow.children].find((cell) => clean(cell.textContent) === "상세") || headerRow.lastElementChild;
    const th = document.createElement("th");
    th.className = "interest-header-cell";
    th.textContent = "관심";
    headerRow.insertBefore(th, detailHeader);
  }

  function enhanceCurrentRows() {
    const rows = [...document.querySelectorAll("#resultBody tr:not(.detail-row)")];
    rows.forEach((row) => {
      if (row.dataset.interestReady === "true") return;
      const story = extractStoryFromMainRow(row);
      if (!story.id) return;
      row.dataset.interestReady = "true";
      row.dataset.articleId = story.id;

      const detailCell = row.lastElementChild;
      const td = document.createElement("td");
      td.className = "interest-cell";
      td.dataset.label = "관심";
      td.appendChild(createInterestButton(story));
      row.insertBefore(td, detailCell);
    });

    enhanceDetailRows();
    hydrateVisibleButtons();
  }

  function enhanceDetailRows() {
    const detailRows = [...document.querySelectorAll("#resultBody tr.detail-row")];
    detailRows.forEach((detailRow) => {
      if (detailRow.dataset.interestReady === "true") return;
      const previous = previousMainRow(detailRow);
      if (!previous?.dataset.articleId) return;
      const story = extractStoryFromMainRow(previous);
      if (!story.id) return;
      detailRow.dataset.interestReady = "true";

      const panel = detailRow.querySelector(".detail-panel > div:first-child");
      if (!panel) return;
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
    });
  }

  function enhanceTopNewsCards() {
    const cards = [...document.querySelectorAll("#topNewsCards .top-news-card")];
    cards.forEach((card) => {
      if (card.dataset.interestReady === "true") return;
      const story = extractStoryFromTopCard(card);
      if (!story.id) return;
      card.dataset.interestReady = "true";
      card.dataset.articleId = story.id;
      card.appendChild(createInterestButton(story));
    });
    hydrateVisibleButtons();
  }

  function enhanceProjectPage() {
    const projectContent = document.getElementById("projectContent");
    const projectTitle = document.getElementById("projectTitle");
    if (!projectContent || !projectTitle || projectContent.hidden) return;

    const projectStory = extractProjectStory();
    if (projectStory.id) {
      installProjectInterestBox(projectStory);
    }

    enhanceProjectArticleCards();
    refreshProjectAggregate();
    hydrateVisibleButtons();
  }

  function installProjectInterestBox(projectStory) {
    const toolbar = document.querySelector(".project-toolbar");
    if (!toolbar || toolbar.querySelector(".project-interest-box")) return;

    const box = document.createElement("div");
    box.className = "project-interest-box";
    box.dataset.projectInterestId = projectStory.id;
    box.innerHTML = `
      <span class="project-interest-label">프로젝트 관심</span>
      <strong class="project-interest-total" data-project-total-count>0</strong>
      <span class="project-interest-caption">프로젝트 직접 관심 + 연결 기사 관심 합산</span>
    `;
    const button = createInterestButton(projectStory, { role: "project" });
    box.insertBefore(button, box.querySelector(".project-interest-caption"));
    toolbar.appendChild(box);
  }

  function enhanceProjectArticleCards() {
    const cards = [...document.querySelectorAll("#projectArticles .project-article-card")];
    cards.forEach((card) => {
      if (card.dataset.interestReady === "true") return;
      const story = extractStoryFromProjectArticle(card);
      if (!story.id) return;
      card.dataset.interestReady = "true";
      card.dataset.articleId = story.id;
      card.dataset.projectLinkedInterest = "true";

      const meta = card.querySelector(".project-article-meta") || card;
      const wrap = document.createElement("span");
      wrap.className = "project-article-interest";
      wrap.appendChild(createInterestButton(story, { role: "project-article" }));
      meta.appendChild(wrap);
    });
  }

  function createInterestButton(story, options = {}) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "interest-button";
    if (options.role) button.dataset.interestRole = options.role;
    button.dataset.articleId = story.id;
    button.dataset.articleTitle = story.title;
    button.dataset.articleUrl = story.url || "";
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", "후속 기사 추적 관심 표시");
    button.innerHTML = `<span class="interest-heart" aria-hidden="true">♡</span><span class="interest-count">0</span>`;
    applyLocalState(button);
    queueHydration(story.id);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleInterest(button, story);
    });
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
      showButtonError(story.id);
    } finally {
      setButtonLoading(story.id, false);
      refreshProjectAggregate();
    }
  }

  function queueHydration(articleId) {
    hydrationQueue.add(articleId);
    clearTimeout(hydrationTimer);
    hydrationTimer = setTimeout(hydrateVisibleButtons, 160);
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
      const items = payload.items || [];
      items.forEach((item) => {
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
    const linkedArticleIds = [...new Set(
      [...document.querySelectorAll("#projectArticles .project-article-card[data-project-linked-interest='true']")]
        .map((card) => card.dataset.articleId)
        .filter(Boolean),
    )];
    const totalIds = [...new Set([projectId, ...linkedArticleIds].filter(Boolean))];
    const total = totalIds.reduce((sum, id) => sum + getLocalCount(id), 0);
    totalEl.textContent = numberFormat(total);
  }

  function applyLocalState(button) {
    const id = button.dataset.articleId;
    updateButtons(id, hasLocalVote(id), getLocalCount(id));
  }

  function setButtonLoading(articleId, isLoading) {
    document.querySelectorAll(`.interest-button[data-article-id="${cssEscape(articleId)}"]`).forEach((button) => {
      button.classList.toggle("is-loading", isLoading);
      button.disabled = isLoading;
    });
  }

  function showButtonError(articleId) {
    document.querySelectorAll(`.interest-button[data-article-id="${cssEscape(articleId)}"]`).forEach((button) => {
      button.title = "관심 수 서버 저장에 실패하여 이 브라우저에만 임시 반영되었습니다.";
    });
  }

  function extractStoryFromMainRow(row) {
    const titleEl = row.querySelector(".market-title-cell .title-link") || row.querySelector(".market-title-cell a, .market-title-cell span");
    const title = clean(titleEl?.textContent) || "제목 없음";
    const url = titleEl?.href || "";
    const country = clean(row.querySelector('[data-label="국가"] .country-name')?.textContent || row.children[2]?.textContent);
    const sector = clean(row.querySelector('[data-label="섹터"]')?.textContent || row.children[3]?.textContent);
    const date = clean(row.querySelector('[data-label="원문게재일"]')?.textContent || row.children[5]?.textContent);
    return {
      id: makeArticleId({ title, url, country, sector, date }),
      title,
      url,
    };
  }

  function extractStoryFromTopCard(card) {
    const link = card.querySelector("h3 a");
    const title = clean(link?.textContent || card.querySelector("h3")?.textContent) || "제목 없음";
    const url = link?.href || "";
    const metaText = clean(card.querySelector(".top-news-meta")?.textContent);
    const footText = clean(card.querySelector(".top-news-foot")?.textContent);
    return {
      id: makeArticleId({ title, url, country: metaText, sector: "", date: footText }),
      title,
      url,
    };
  }

  function extractProjectStory() {
    const params = new URLSearchParams(window.location.search);
    const title = clean(document.getElementById("projectTitle")?.textContent) || clean(params.get("name")) || "프로젝트";
    const subtitle = clean(document.getElementById("projectSubtitle")?.textContent);
    const projectId = clean(params.get("id"));
    const country = clean(params.get("country"));
    const sector = clean(params.get("sector"));
    return {
      id: makeProjectId({ projectId, title, country, sector, subtitle }),
      title: `프로젝트: ${title}`,
      url: window.location.href,
    };
  }

  function extractStoryFromProjectArticle(card) {
    const title = clean(card.querySelector("h3")?.textContent) || "제목 없음";
    const link = card.querySelector('.project-article-meta a[href]');
    const url = link?.href || "";
    const metaText = clean(card.querySelector(".project-article-meta")?.textContent);
    return {
      id: makeArticleId({ title, url, country: metaText, sector: "", date: metaText }),
      title,
      url,
    };
  }

  function previousMainRow(row) {
    let current = row.previousElementSibling;
    while (current && current.classList.contains("detail-row")) current = current.previousElementSibling;
    return current;
  }

  function makeArticleId({ title, url, country, sector, date }) {
    const primary = clean(url) || clean(title);
    const seed = primary ? [primary, title].map(clean).join("|") : [title, country, sector, date].map(clean).join("|");
    return `article-${hashSeed(seed)}`;
  }

  function makeProjectId({ projectId, title, country, sector, subtitle }) {
    const primary = clean(projectId) || [title, country, sector, subtitle].map(clean).join("|");
    return `project-${hashSeed(primary)}`;
  }

  function hashSeed(seed) {
    let hash = 2166136261;
    for (let i = 0; i < seed.length; i += 1) {
      hash ^= seed.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
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
