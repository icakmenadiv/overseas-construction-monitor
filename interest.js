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
    window.InterestFeature = {
      enabled: false,
      reason: "disabled_by_feature_flag",
    };
    return;
  }

  const InterestFeature = {
    enabled: true,
    enhanceMarketRow,
    enhanceMarketDetailRow,
    enhanceTopNewsCard,
    enhanceProjectToolbar,
    enhanceProjectArticleCard,
    hydrate: debounce(hydrateVisibleButtons, 120),
    refreshProjectAggregate,
  };

  window.InterestFeature = InterestFeature;
  ensureVisitorId();
  wrapMarketRenderers();
  wrapProjectRenderers();

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

  function wrapMarketRenderers() {
    if (typeof window.createMainRow === "function") {
      const originalCreateMainRow = window.createMainRow;
      window.createMainRow = function wrappedCreateMainRow(row, isExpanded) {
        const tr = originalCreateMainRow.call(this, row, isExpanded);
        enhanceMarketRow(tr, row);
        return tr;
      };
    }

    if (typeof window.createDetailRow === "function") {
      const originalCreateDetailRow = window.createDetailRow;
      window.createDetailRow = function wrappedCreateDetailRow(row) {
        const tr = originalCreateDetailRow.call(this, row);
        enhanceMarketDetailRow(tr, row);
        return tr;
      };
    }

    if (typeof window.createTopNewsCard === "function") {
      const originalCreateTopNewsCard = window.createTopNewsCard;
      window.createTopNewsCard = function wrappedCreateTopNewsCard(row, rank) {
        const card = originalCreateTopNewsCard.call(this, row, rank);
        enhanceTopNewsCard(card, row);
        return card;
      };
    }
  }

  function wrapProjectRenderers() {
    if (typeof window.renderProject === "function") {
      const originalRenderProject = window.renderProject;
      window.renderProject = function wrappedRenderProject(project, articleItems) {
        const result = originalRenderProject.call(this, project, articleItems);
        enhanceProjectToolbar(project, articleItems);
        hydrateVisibleButtons();
        return result;
      };
    }

    if (typeof window.renderArticleCard === "function") {
      const originalRenderArticleCard = window.renderArticleCard;
      window.renderArticleCard = function wrappedRenderArticleCard(item) {
        const html = originalRenderArticleCard.call(this, item);
        return injectProjectArticleInterest(html, item);
      };
    }
  }

  function enhanceMarketRow(tr, row) {
    if (!tr || tr.dataset.interestReady === "true") return tr;
    const story = storyFromMarketRow(row);
    if (!story.id) return tr;

    const td = document.createElement("td");
    td.className = "interest-cell";
    td.dataset.label = "관심";
    td.appendChild(createInterestButton(story));

    const detailCell = tr.lastElementChild;
    tr.insertBefore(td, detailCell);
    tr.dataset.interestReady = "true";
    InterestFeature.hydrate();
    return tr;
  }

  function enhanceMarketDetailRow(tr, row) {
    if (!tr || tr.dataset.interestReady === "true") return tr;
    const story = storyFromMarketRow(row);
    const panel = tr.querySelector(".detail-panel > div:first-child");
    if (!panel || !story.id) return tr;

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
    tr.dataset.interestReady = "true";
    InterestFeature.hydrate();
    return tr;
  }

  function enhanceTopNewsCard(card, row) {
    if (!card || card.dataset.interestReady === "true") return card;
    const story = storyFromMarketRow(row);
    if (!story.id) return card;
    card.appendChild(createInterestButton(story));
    card.dataset.interestReady = "true";
    InterestFeature.hydrate();
    return card;
  }

  function enhanceProjectToolbar(project, articleItems = []) {
    const toolbar = document.querySelector(".project-toolbar");
    if (!toolbar || toolbar.querySelector(".project-interest-box")) return;

    const story = storyFromProject(project);
    const box = document.createElement("div");
    box.className = "project-interest-box";
    box.dataset.projectInterestId = story.id;
    box.innerHTML = `
      <span class="project-interest-label">프로젝트 관심</span>
      <strong class="project-interest-total" data-project-total-count>0</strong>
      <span class="project-interest-caption">프로젝트 직접 관심 + 연결 기사 관심 합산</span>
    `;
    box.insertBefore(createInterestButton(story, "project"), box.querySelector(".project-interest-caption"));
    toolbar.appendChild(box);

    document.querySelectorAll("#projectArticles .project-article-card").forEach((card, index) => {
      const item = articleItems[index];
      if (item) enhanceProjectArticleCard(card, item);
    });
  }

  function enhanceProjectArticleCard(card, item) {
    if (!card || card.dataset.interestReady === "true") return card;
    const story = storyFromProjectArticle(item);
    if (!story.id) return card;
    const meta = card.querySelector(".project-article-meta") || card;
    const wrap = document.createElement("span");
    wrap.className = "project-article-interest";
    wrap.appendChild(createInterestButton(story, "project-article"));
    meta.appendChild(wrap);
    card.dataset.articleId = story.id;
    card.dataset.projectLinkedInterest = "true";
    card.dataset.interestReady = "true";
    InterestFeature.hydrate();
    return card;
  }

  function injectProjectArticleInterest(html, item) {
    const story = storyFromProjectArticle(item);
    const buttonHtml = renderInterestButtonHtml(story, "project-article");
    return html.replace(
      /(<\/div>\s*<\/article>\s*)$/,
      `<span class="project-article-interest" data-project-linked-interest="true" data-article-id="${escapeAttribute(story.id)}">${buttonHtml}</span>$1`,
    );
  }

  function createInterestButton(story, role = "article") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "interest-button";
    button.dataset.interestRole = role;
    button.dataset.articleId = story.id;
    button.dataset.articleTitle = story.title;
    button.dataset.articleUrl = story.url || "";
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

  function renderInterestButtonHtml(story, role = "article") {
    const active = hasLocalVote(story.id);
    const count = getLocalCount(story.id);
    return `<button type="button" class="interest-button${active ? " is-active" : ""}" data-interest-role="${escapeAttribute(role)}" data-article-id="${escapeAttribute(story.id)}" data-article-title="${escapeAttribute(story.title)}" data-article-url="${escapeAttribute(story.url || "")}" aria-pressed="${active}" aria-label="후속 기사 추적 관심 표시"><span class="interest-heart" aria-hidden="true">${active ? "♥" : "♡"}</span><span class="interest-count">${numberFormat(count)}</span></button>`;
  }

  async function hydrateVisibleButtons() {
    bindStaticButtons();
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

  function bindStaticButtons() {
    document.querySelectorAll(".interest-button:not([data-interest-bound='true'])").forEach((button) => {
      button.dataset.interestBound = "true";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleInterest(button, {
          id: button.dataset.articleId,
          title: button.dataset.articleTitle || "관심 항목",
          url: button.dataset.articleUrl || "",
        });
      });
    });
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
    const linkedIds = [...new Set([...document.querySelectorAll("#projectArticles [data-project-linked-interest='true'], #projectArticles .project-article-card[data-project-linked-interest='true']")].map((node) => node.dataset.articleId).filter(Boolean))];
    const ids = [...new Set([projectId, ...linkedIds].filter(Boolean))];
    const total = ids.reduce((sum, id) => sum + getLocalCount(id), 0);
    totalEl.textContent = numberFormat(total);
  }

  function storyFromMarketRow(row) {
    const title = clean(row?.["제목(한글)"] || row?.["제목(원문)"] || "제목 없음");
    const url = clean(row?.["출처링크"]);
    return {
      id: makeArticleId({ title, url, articleId: row?.["기사 고유값"], country: row?.["국가"], sector: row?.["섹터"], date: row?.["원문게재일"] }),
      title,
      url,
    };
  }

  function storyFromProject(project) {
    const title = clean(project?.["프로젝트명"] || document.getElementById("projectTitle")?.textContent || "프로젝트");
    return {
      id: makeProjectId({ projectId: project?.["프로젝트 고유값"], title, country: project?.["국가"], sector: project?.["섹터"] }),
      title: `프로젝트: ${title}`,
      url: window.location.href,
    };
  }

  function storyFromProjectArticle(item) {
    const article = item?.article || item || {};
    const mapping = item?.mapping || {};
    const title = clean(article["제목(한글)"] || article["제목(원문)"] || "제목 없음");
    const url = clean(article["출처링크"]);
    return {
      id: makeArticleId({ title, url, articleId: mapping["기사 고유값"] || article["기사 고유값"], country: article["국가"], sector: article["섹터"], date: mapping["기사일자"] || article["원문게재일"] }),
      title,
      url,
    };
  }

  function makeArticleId({ title, url, articleId, country, sector, date }) {
    const seed = clean(articleId) || clean(url) || [title, country, sector, date].map(clean).join("|");
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
    const id = button.dataset.articleId;
    updateButtons(id, hasLocalVote(id), getLocalCount(id));
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

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
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

  function escapeAttribute(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;")
      .replaceAll("`", "&#096;");
  }
})();
