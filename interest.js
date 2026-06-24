(() => {
  const STORAGE_KEYS = {
    localVotes: "icakInterestLocalVotes",
    localDeltas: "icakInterestLocalDeltas",
  };
  const COUNT_COLUMNS = ["관심도", "관심도 집계", "관심수", "하트수", "관심도 수치"];
  const PROJECT_ENHANCE_DELAYS = [0, 120, 360, 900, 1800, 3200];
  let projectObserverReady = false;

  window.InterestFeature = {
    enabled: true,
    enhanceDetailRow,
    hydrate: hydrateButtons,
  };

  wrapMarketRenderers();
  wrapTopNewsRenderer();
  wrapProjectRenderer();
  document.addEventListener("DOMContentLoaded", () => {
    wrapMarketRenderers();
    wrapTopNewsRenderer();
    wrapProjectRenderer();
    watchProjectPage();
    scheduleProjectEnhance();
    hydrateButtons();
  });
  if (document.readyState !== "loading") {
    watchProjectPage();
    scheduleProjectEnhance();
  }

  function wrapMarketRenderers() {
    if (window.__interestMarketWrapped || typeof window.createMainRow !== "function") return;
    window.__interestMarketWrapped = true;
    const originalCreateMainRow = window.createMainRow;
    window.createMainRow = function createMainRowWithInterest(row, isExpanded) {
      const tr = originalCreateMainRow.call(this, row, isExpanded);
      return enhanceMarketRow(tr, row);
    };
  }

  function wrapTopNewsRenderer() {
    if (window.__interestTopNewsWrapped || typeof window.createTopNewsCard !== "function") return;
    window.__interestTopNewsWrapped = true;
    const originalCreateTopNewsCard = window.createTopNewsCard;
    window.createTopNewsCard = function createTopNewsCardWithInterest(row, rank) {
      const card = originalCreateTopNewsCard.call(this, row, rank);
      const story = storyFromArticleRow(row);
      if (!story.id) return card;
      card.dataset.articleId = story.id;
      card.dataset.sheetInterestCount = String(story.sheetCount);
      const wrap = document.createElement("div");
      wrap.className = "top-news-interest";
      wrap.appendChild(createInterestButton(story, "top-news"));
      card.appendChild(wrap);
      return card;
    };
  }

  function wrapProjectRenderer() {
    if (window.__interestProjectWrapped || typeof window.renderProject !== "function") return;
    window.__interestProjectWrapped = true;
    const originalRenderProject = window.renderProject;
    window.renderProject = function renderProjectWithInterest(project, articleItems) {
      const result = originalRenderProject.call(this, project, articleItems);
      scheduleProjectEnhance();
      return result;
    };
  }

  function watchProjectPage() {
    if (projectObserverReady) return;
    const content = document.getElementById("projectContent");
    if (!content) return;
    projectObserverReady = true;
    const observer = new MutationObserver(() => scheduleProjectEnhance());
    observer.observe(content, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
  }

  function scheduleProjectEnhance() {
    PROJECT_ENHANCE_DELAYS.forEach((delay) => setTimeout(() => {
      enhanceExistingProjectPage();
      hydrateButtons();
    }, delay));
  }

  function enhanceMarketRow(row, rowData) {
    if (!row || row.classList.contains("detail-row")) return row;
    const detailCell = [...row.children].find((cell) => cell.querySelector(".detail-button") || clean(cell.dataset.label) === "상세");
    const story = storyFromArticleRow(rowData);
    if (!story.id) return row;
    const cell = detailCell || document.createElement("td");
    cell.className = "interest-cell";
    cell.dataset.label = "관심";
    cell.replaceChildren(createInterestButton(story, "article"));
    if (!detailCell) row.appendChild(cell);
    row.dataset.articleId = story.id;
    row.dataset.sheetInterestCount = String(story.sheetCount);
    return row;
  }

  function enhanceDetailRow(detailRow, rowData) {
    const story = storyFromArticleRow(rowData);
    const panel = detailRow?.querySelector(".detail-panel > div:first-child");
    if (!story.id || !panel || panel.querySelector(".interest-detail-box")) return;
    const box = document.createElement("div");
    box.className = "interest-detail-box";
    box.innerHTML = "<strong>활용 가치가 높은 경우나 후속기사 추적을 원하는 경우 표시</strong>";
    box.appendChild(createInterestButton(story, "detail"));
    panel.appendChild(box);
    hydrateButtons(story.id);
  }

  function enhanceExistingProjectPage() {
    const content = document.getElementById("projectContent");
    if (!content || content.hidden) return;
    ensureProjectInterestBox();
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
    });
    refreshProjectAggregate();
  }

  function ensureProjectInterestBox() {
    const toolbar = document.querySelector(".project-toolbar");
    if (!toolbar || toolbar.querySelector(".project-interest-box")) return;
    const projectStory = storyFromProjectPage();
    const box = document.createElement("div");
    box.className = "project-interest-box";
    box.innerHTML = `
      <span class="project-interest-label">프로젝트 관심 표시</span>
      <strong class="project-interest-total" data-project-total-count>0</strong>
      <span class="project-interest-caption">관심 표시 수는 관련 기사 관심도와 이 화면의 프로젝트 표시를 함께 보는 참고 신호입니다.</span>`;
    box.insertBefore(createInterestButton(projectStory, "project"), box.querySelector(".project-interest-caption"));
    toolbar.appendChild(box);
  }

  function createInterestButton(story, role) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "interest-button";
    button.dataset.interestRole = role;
    button.dataset.articleId = story.id;
    button.dataset.sheetCount = String(story.sheetCount || 0);
    button.setAttribute("aria-label", "활용 가치가 높은 경우나 후속기사 추적을 원하는 경우 표시");
    button.innerHTML = '<span class="interest-heart" aria-hidden="true">♡</span><span class="interest-count">0</span>';
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleInterest(story.id, Number(button.dataset.sheetCount || 0));
    });
    syncButton(button);
    return button;
  }

  function toggleInterest(articleId, sheetCount) {
    const votes = readJson(STORAGE_KEYS.localVotes, {});
    const deltas = readJson(STORAGE_KEYS.localDeltas, {});
    const active = !votes[articleId];
    if (active) {
      votes[articleId] = true;
      deltas[articleId] = Number(deltas[articleId] || 0) + 1;
    } else {
      delete votes[articleId];
      deltas[articleId] = Number(deltas[articleId] || 0) - 1;
    }
    writeJson(STORAGE_KEYS.localVotes, votes);
    writeJson(STORAGE_KEYS.localDeltas, deltas);
    hydrateButtons(articleId, sheetCount);
  }

  function hydrateButtons(onlyArticleId = "", fallbackSheetCount = 0) {
    document.querySelectorAll(".interest-button").forEach((button) => {
      if (onlyArticleId && button.dataset.articleId !== onlyArticleId) return;
      if (fallbackSheetCount && !button.dataset.sheetCount) button.dataset.sheetCount = String(fallbackSheetCount);
      syncButton(button);
    });
    refreshProjectAggregate();
  }

  function syncButton(button) {
    const articleId = button.dataset.articleId;
    const active = Boolean(readJson(STORAGE_KEYS.localVotes, {})[articleId]);
    const sheetCount = Number(button.dataset.sheetCount || 0);
    const count = Math.max(0, sheetCount + Number(readJson(STORAGE_KEYS.localDeltas, {})[articleId] || 0));
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
    const heart = button.querySelector(".interest-heart");
    const countEl = button.querySelector(".interest-count");
    if (heart) heart.textContent = active ? "♥" : "♡";
    if (countEl) countEl.textContent = numberFormat(count);
  }

  function refreshProjectAggregate() {
    const totalEl = document.querySelector("[data-project-total-count]");
    if (!totalEl) return;
    const articleIds = [...new Set([...document.querySelectorAll("#projectArticles .project-article-interest")].map((node) => node.dataset.articleId).filter(Boolean))];
    const articleTotal = articleIds.reduce((sum, id) => {
      const button = document.querySelector(`.interest-button[data-article-id="${cssEscape(id)}"]`);
      const sheetCount = Number(button?.dataset.sheetCount || 0);
      return sum + Math.max(0, sheetCount + Number(readJson(STORAGE_KEYS.localDeltas, {})[id] || 0));
    }, 0);
    const projectId = storyFromProjectPage().id;
    const projectButton = document.querySelector(`.project-interest-box .interest-button[data-article-id="${cssEscape(projectId)}"]`);
    const projectTotal = projectButton ? Math.max(0, Number(projectButton.dataset.sheetCount || 0) + Number(readJson(STORAGE_KEYS.localDeltas, {})[projectId] || 0)) : 0;
    totalEl.textContent = numberFormat(articleTotal + projectTotal);
  }

  function storyFromArticleRow(row) {
    const id = clean(row?.["기사 고유값"]) || clean(row?.id);
    return { id, sheetCount: getSheetCount(row) };
  }

  function storyFromProjectArticleCard(card) {
    const id = clean(card.dataset.articleId);
    return { id, sheetCount: Number(card.dataset.sheetInterestCount || 0) };
  }

  function storyFromProjectPage() {
    const params = new URLSearchParams(window.location.search);
    const id = clean(params.get("id")) || clean(params.get("name")) || clean(document.getElementById("projectTitle")?.textContent) || "project-detail";
    return { id: `project:${id}`, sheetCount: 0 };
  }

  function getSheetCount(row) {
    for (const column of COUNT_COLUMNS) {
      const value = Number(String(row?.[column] || "").replace(/[^0-9.-]/g, ""));
      if (Number.isFinite(value) && value > 0) return value;
    }
    return 0;
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
      console.warn("Failed to write interest state:", error);
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
    return String(value).replace(/["\\]/g, "\\$&");
  }
})();