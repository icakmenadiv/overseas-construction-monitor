(() => {
  const RUN_DELAYS = [0, 120, 360, 900, 1800, 3200];
  let queued = false;
  let initialized = false;

  document.addEventListener("DOMContentLoaded", init);
  if (document.readyState !== "loading") init();

  function init() {
    if (initialized) return;
    initialized = true;
    injectStyles();
    patchMenuLabels();
    RUN_DELAYS.forEach((delay) => setTimeout(run, delay));
    document.addEventListener("click", queueRun, true);
    document.addEventListener("change", queueRun, true);
    document.addEventListener("input", queueRun, true);
  }

  function queueRun() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      run();
    });
  }

  function run() {
    patchMenuLabels();
    moveSortFieldToTop();
    setupCollapsibleFilters();
    updateFilterSummaries();
    enhanceTopNewsCards();
    enhanceFeaturedProjectCards();
    markDatePresets();
  }

  function patchMenuLabels() {
    const navLinks = document.querySelectorAll(".page-nav a");
    if (navLinks[0]) navLinks[0].textContent = "해외 건설시장 뉴스";
    if (navLinks[1]) navLinks[1].textContent = "프로젝트 목록";
  }

  function moveSortFieldToTop() {
    const sort = document.getElementById("sortSelect");
    const sortField = sort?.closest(".field");
    const topActions = document.querySelector(".control-panel .filter-top-actions");
    if (!sort || !sortField || !topActions || sortField.dataset.sortTopReady === "true") return;

    sortField.classList.add("sort-field-top");
    sortField.dataset.sortTopReady = "true";
    topActions.appendChild(sortField);
  }

  function setupCollapsibleFilters() {
    document.querySelectorAll(".field-wide").forEach((field) => {
      if (field.dataset.coreFilterReady === "true") return;
      const label = field.querySelector(":scope > .field-label");
      const filter = field.querySelector(":scope > .checkbox-filter");
      if (!label || !filter) return;

      const details = document.createElement("details");
      details.className = "filter-collapse core-filter-collapse";
      details.open = false;

      const summary = document.createElement("summary");
      summary.className = "filter-summary";
      const title = document.createElement("span");
      title.className = "filter-summary-title";
      title.textContent = clean(label.textContent) || "필터";
      const count = document.createElement("span");
      count.className = "filter-summary-count";
      count.textContent = "전체";
      summary.append(title, count);

      label.remove();
      field.appendChild(details);
      details.append(summary, filter);
      field.dataset.coreFilterReady = "true";

      let closeTimer = null;
      details.addEventListener("mouseenter", () => {
        clearTimeout(closeTimer);
        details.open = true;
      });
      details.addEventListener("mouseleave", () => {
        closeTimer = setTimeout(() => {
          details.open = false;
        }, 140);
      });
    });
  }

  function updateFilterSummaries() {
    document.querySelectorAll(".filter-collapse").forEach((details) => {
      const filter = details.querySelector(".checkbox-filter");
      const count = details.querySelector(".filter-summary-count");
      if (!filter || !count) return;
      const checked = filter.querySelectorAll('input[type="checkbox"]:checked').length;
      const total = filter.querySelectorAll('input[type="checkbox"]').length;
      count.textContent = checked ? `${formatNumber(checked)}개 선택` : total ? "전체" : "항목 없음";
    });
  }

  function enhanceTopNewsCards() {
    document.querySelectorAll("#topNewsCards .top-news-card").forEach((card) => {
      if (card.dataset.coreCardReady !== "true") {
        card.tabIndex = 0;
        card.setAttribute("role", "button");
        card.dataset.coreCardReady = "true";
        card.addEventListener("click", (event) => {
          if (event.target.closest("a,button")) return;
          openMatchingArticle(card);
        });
        card.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          openMatchingArticle(card);
        });
      }

      const matchedRow = findMatchingArticleRow(card);
      if (matchedRow) card.dataset.articleId = matchedRow.dataset.articleId || matchedRow.dataset.rowId || "";
      ensureTopNewsBadges(card, matchedRow);
      ensureOpenHint(card);
    });
  }

  function ensureTopNewsBadges(card, row) {
    const badgeGroups = [...card.querySelectorAll(".top-news-badges")];
    const wrap = badgeGroups[0] || document.createElement("div");
    badgeGroups.slice(1).forEach((group) => group.remove());
    if (!wrap.parentElement) {
      wrap.className = "top-news-badges";
      const title = card.querySelector("h3");
      title?.insertAdjacentElement("afterend", wrap);
    }

    const cells = row ? [...row.children] : [];
    const keyword = clean(cells.find((cell) => clean(cell.dataset.label) === "핵심 키워드")?.textContent);
    const infoClass = clean(cells.find((cell) => clean(cell.dataset.label) === "정보 분류")?.textContent);
    const country = clean(cells.find((cell) => clean(cell.dataset.label) === "국가")?.querySelector(".country-name")?.textContent);
    const signature = [infoClass, country, keyword].join("|") || "static";
    if (wrap.dataset.badgeSignature === signature) return;

    wrap.innerHTML = [
      infoClass ? `<span class="top-news-badge is-info">${escapeHtml(infoClass)}</span>` : "",
      country ? `<span class="top-news-badge">${escapeHtml(country)}</span>` : "",
      keyword ? `<span class="top-news-badge is-keyword">${escapeHtml(keyword)}</span>` : "",
    ].join("");
    wrap.dataset.badgeSignature = signature;
  }

  function ensureOpenHint(card) {
    const hints = [...card.querySelectorAll(".top-news-open-hint")];
    hints.slice(1).forEach((hint) => hint.remove());
    if (hints[0]) return;
    const hint = document.createElement("span");
    hint.className = "top-news-open-hint";
    hint.textContent = "카드 클릭 시 목록 상세 열기";
    card.appendChild(hint);
  }

  function openMatchingArticle(card) {
    const row = findMatchingArticleRow(card);
    if (!row) return;
    const button = row.querySelector(".detail-button");
    if (button?.getAttribute("aria-expanded") !== "true") button?.click();
    requestAnimationFrame(() => row.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  function findMatchingArticleRow(card) {
    const cardTitle = normalize(card.querySelector("h3")?.textContent);
    const cardUrl = normalizeUrl(card.querySelector("h3 a")?.getAttribute("href") || "");
    const cardArticleId = clean(card.dataset.articleId);
    const rows = [...document.querySelectorAll("#resultBody tr:not(.detail-row)")];
    return rows.find((row) => {
      if (cardArticleId && (row.dataset.articleId === cardArticleId || row.dataset.rowId === cardArticleId)) return true;
      const titleEl = row.querySelector(".market-title-cell .title-link") || row.querySelector(".market-title-cell a, .market-title-cell span");
      const rowTitle = normalize(titleEl?.textContent);
      const rowUrl = normalizeUrl(titleEl?.getAttribute("href") || "");
      return Boolean((cardUrl && rowUrl && cardUrl === rowUrl) || (cardTitle && rowTitle && cardTitle === rowTitle));
    });
  }

  function enhanceFeaturedProjectCards() {
    document.querySelectorAll(".featured-project-card").forEach((card) => {
      const link = card.querySelector("a");
      if (!link) return;
      const badgeGroups = [...link.querySelectorAll(".featured-project-badges")];
      const wrap = badgeGroups[0] || document.createElement("span");
      badgeGroups.slice(1).forEach((group) => group.remove());
      if (!wrap.parentElement) {
        wrap.className = "featured-project-badges";
        link.appendChild(wrap);
      }

      const cost = clean(card.querySelector(".featured-cost")?.textContent);
      const metaParts = clean(card.querySelector(".featured-meta")?.textContent).split("·").map(clean).filter(Boolean);
      const keyword = clean(card.querySelector(".featured-keyword")?.textContent);
      const signature = [cost, metaParts[2], keyword].join("|");
      if (wrap.dataset.badgeSignature === signature) return;

      wrap.innerHTML = [
        cost ? `<span class="featured-project-badge is-cost">${escapeHtml(cost)}</span>` : "",
        metaParts[2] ? `<span class="featured-project-badge is-stage">${escapeHtml(metaParts[2])}</span>` : "",
        keyword && keyword !== "키워드 미확인" ? `<span class="featured-project-badge">${escapeHtml(keyword)}</span>` : "",
      ].join("");
      wrap.dataset.badgeSignature = signature;
    });
  }

  function markDatePresets() {
    document.querySelectorAll(".date-preset-button").forEach((button) => {
      button.title = "클릭하면 기간이 바로 적용됩니다.";
    });
  }

  function injectStyles() {
    if (document.getElementById("monitorCoreUiStyle")) return;
    const style = document.createElement("style");
    style.id = "monitorCoreUiStyle";
    style.textContent = `
      @media (min-width:1120px){
        .dashboard{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:18px;align-items:start}
        .dashboard>.control-panel,.dashboard>.featured-projects,.dashboard>.results-section{grid-column:1}
        .dashboard>.summary-grid{grid-column:2;grid-row:1 / span 3;position:sticky;top:16px;z-index:4;align-self:start}
      }
      .filter-top-actions{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .sort-field-top{display:flex;align-items:center;gap:8px;margin-left:auto;min-width:220px}
      .sort-field-top label,.sort-field-top .sort-label-row{margin:0;white-space:nowrap}
      .sort-field-top select{min-width:180px}
      .filter-collapse{width:100%}
      .filter-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:42px;padding:10px 12px;border:1px solid rgba(30,41,59,.14);border-radius:8px;background:#fff;cursor:pointer;list-style:none}
      .filter-summary::-webkit-details-marker{display:none}
      .filter-summary-title{font-weight:700}
      .filter-summary-count{font-size:.9rem;color:#64748b;white-space:nowrap}
      .filter-collapse[open] .filter-summary{border-bottom-left-radius:0;border-bottom-right-radius:0}
      .filter-collapse .checkbox-filter{max-height:230px;overflow-y:auto;overscroll-behavior:contain;padding:10px 4px 2px 0;scrollbar-width:thin}
      .filter-collapse .checkbox-filter::-webkit-scrollbar{width:8px}
      .filter-collapse .checkbox-filter::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:999px}
      .top-news-card{cursor:pointer}
      .top-news-card:hover,.top-news-card:focus{transform:translateY(-1px)}
      .top-news-badges,.featured-project-badges{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
      .top-news-badge,.featured-project-badge{display:inline-flex;align-items:center;min-height:24px;padding:3px 8px;border-radius:999px;background:#eef2ff;color:#3730a3;font-size:.82rem;font-weight:700}
      .top-news-badge.is-info,.featured-project-badge.is-stage{background:#ecfdf5;color:#047857}
      .top-news-badge.is-keyword{background:#f8fafc;color:#334155}
      .featured-project-badge.is-cost{background:#fff7ed;color:#9a3412}
      .top-news-open-hint{display:inline-flex;margin-top:8px;color:#475569;font-size:.86rem}
      @media (max-width:720px){
        .filter-top-actions{align-items:stretch}
        .sort-field-top{width:100%;margin-left:0;justify-content:space-between}
        .sort-field-top select{flex:1;min-width:0}
      }
    `;
    document.head.appendChild(style);
  }

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalize(value) {
    return clean(value).toLowerCase();
  }

  function normalizeUrl(value) {
    try {
      const url = new URL(value, window.location.href);
      url.hash = "";
      ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"].forEach((key) => url.searchParams.delete(key));
      return `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}?${url.searchParams.toString()}`.toLowerCase();
    } catch (error) {
      return normalize(value).replace(/\/$/, "");
    }
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("ko-KR").format(Number(value || 0));
  }
})();