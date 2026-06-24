(() => {
  const RUN_DELAYS = [0, 120, 360, 900, 1800, 3200];
  let queued = false;
  let initialized = false;
  let expandedTopNewsRowKey = "";

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
    moveSummaryIntoFilter();
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

  function moveSummaryIntoFilter() {
    const panel = document.querySelector(".market-filter-panel");
    const summary = document.querySelector(".market-dashboard .summary-grid");
    if (!panel || !summary || panel.contains(summary)) return;
    panel.insertBefore(summary, panel.firstElementChild);
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
    const cards = [...document.querySelectorAll("#topNewsCards .top-news-card")];
    const columnCount = getTopNewsColumnCount();
    cards.forEach((card, index) => {
      const row = findArticleForCard(card);
      const rowKey = `row-${Math.floor(index / columnCount)}`;
      card.dataset.topNewsRowKey = rowKey;
      card.dataset.articleId = row?.id || normalize(card.querySelector("h3")?.textContent);
      card.setAttribute("role", "button");
      card.tabIndex = 0;
      card.setAttribute("aria-expanded", String(expandedTopNewsRowKey === rowKey));

      if (card.dataset.coreCardReady !== "true") {
        card.dataset.coreCardReady = "true";
        card.addEventListener(
          "click",
          (event) => {
            if (event.target.closest(".top-news-source-link, .project-detail-link")) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            toggleTopNewsRow(card);
          },
          true,
        );
        card.addEventListener(
          "keydown",
          (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            event.stopImmediatePropagation();
            toggleTopNewsRow(card);
          },
          true,
        );
      }

      ensureTopNewsBadges(card, row);
      ensureOpenHint(card);
      renderTopNewsDetail(card, row, expandedTopNewsRowKey === rowKey);
    });
  }

  function getTopNewsColumnCount() {
    const grid = document.getElementById("topNewsCards");
    if (!grid) return 1;
    const columns = getComputedStyle(grid).gridTemplateColumns;
    if (!columns || columns === "none") return 1;
    return Math.max(1, columns.split(" ").filter(Boolean).length);
  }

  function toggleTopNewsRow(card) {
    const rowKey = card.dataset.topNewsRowKey || "row-0";
    expandedTopNewsRowKey = expandedTopNewsRowKey === rowKey ? "" : rowKey;
    enhanceTopNewsCards();
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

    const keyword = clean(row?.["주제"]);
    const infoClass = clean(row?.["정보 분류"]);
    const signature = [infoClass, keyword].join("|") || "static";
    if (wrap.dataset.badgeSignature === signature) return;

    wrap.innerHTML = [
      infoClass ? `<span class="top-news-badge is-info">${escapeHtml(infoClass)}</span>` : "",
      keyword ? `<span class="top-news-badge is-keyword">${escapeHtml(keyword)}</span>` : "",
    ].join("");
    wrap.dataset.badgeSignature = signature;
  }

  function ensureOpenHint(card) {
    card.querySelectorAll(".top-news-open-hint").forEach((hint) => hint.remove());
  }

  function renderTopNewsDetail(card, row, isExpanded) {
    let detail = card.querySelector(":scope > .top-news-card-detail");
    if (!isExpanded || !row) {
      detail?.remove();
      return;
    }

    if (!detail) {
      detail = document.createElement("div");
      detail.className = "top-news-card-detail";
      card.appendChild(detail);
    }

    const originalTitle = row["제목(원문)"] || row["제목(한글)"] || "원문 제목 없음";
    const summary = row["내용"] || "내용 요약이 없습니다.";
    detail.innerHTML = `
      <h4>${escapeHtml(originalTitle)}</h4>
      ${row["프로젝트명"] ? renderProjectLink(row) : ""}
      <p>${escapeHtml(summary)}</p>
      <div class="top-news-detail-meta">
        ${row["정보 분류"] ? `<span><strong>정보 분류</strong> ${escapeHtml(row["정보 분류"])}</span>` : ""}
        ${row["관련 단계"] ? `<span><strong>관련 단계</strong> ${escapeHtml(row["관련 단계"])}</span>` : ""}
        ${row["출처언어"] ? `<span><strong>출처언어</strong> ${escapeHtml(row["출처언어"])}</span>` : ""}
        ${row["출처링크"] ? `<a class="top-news-source-link" href="${escapeAttribute(row["출처링크"])}" target="_blank" rel="noreferrer">원문 링크 열기</a>` : ""}
      </div>`;
  }

  function renderProjectLink(row) {
    const params = new URLSearchParams();
    if (row["프로젝트 고유값"]) params.set("id", row["프로젝트 고유값"]);
    if (row["프로젝트명"]) params.set("name", row["프로젝트명"]);
    if (row["국가"]) params.set("country", row["국가"]);
    if (row["섹터"]) params.set("sector", row["섹터"]);
    return `
      <div class="project-callout top-news-project-callout">
        <div>
          <strong>프로젝트명</strong>
          <span>${escapeHtml(row["프로젝트명"])}</span>
        </div>
        <a class="project-detail-link" href="./project.html?${params.toString()}">프로젝트 상세페이지</a>
      </div>`;
  }

  function findArticleForCard(card) {
    const stateRows = window.state?.filteredRows || [];
    const title = normalize(card.querySelector("h3")?.textContent);
    const sourceUrl = normalizeUrl(card.querySelector("h3 a")?.getAttribute("href") || "");
    return stateRows.find((row) => {
      const rowTitle = normalize(row["제목(한글)"] || row["제목(원문)"]);
      const rowUrl = normalizeUrl(row["출처링크"] || "");
      return (sourceUrl && rowUrl && sourceUrl === rowUrl) || (title && rowTitle && title === rowTitle);
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
        .market-dashboard{display:grid !important;grid-template-columns:minmax(300px,360px) minmax(0,1fr) !important;gap:14px !important;align-items:start !important;width:min(1680px,100%) !important;padding:18px clamp(12px,2vw,28px) 34px !important}
        .market-dashboard>.market-filter-panel{grid-column:1 !important;grid-row:1 / span 2 !important;position:sticky !important;top:12px !important;align-self:start !important;width:auto !important;max-height:calc(100vh - 24px) !important;margin:0 !important;padding:12px !important;overflow-x:hidden !important;overflow-y:hidden !important;transform:none !important;scrollbar-gutter:stable}
        .market-dashboard>.market-filter-panel:hover,.market-dashboard>.market-filter-panel:focus-within{overflow-y:auto !important}
        .market-dashboard>.market-results-section{grid-column:2 !important;grid-row:1 / span 2 !important;min-width:0 !important;margin:0 !important}
        .market-filter-panel>.summary-grid{display:grid !important;grid-template-columns:repeat(2,minmax(0,1fr)) !important;gap:6px !important;margin:0 0 10px !important}
        .market-filter-panel>.summary-grid .summary-item:nth-child(5){grid-column:1 / -1}
      }
      .filter-top-actions{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:end;gap:8px;margin:0 0 10px}
      .top-reset-button{min-height:30px !important;padding:0 10px !important;border-radius:6px !important;font-size:.66rem !important;white-space:nowrap}
      .sort-field-top{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:6px;min-width:0;margin-left:0}
      .sort-field-top label,.sort-field-top .sort-label-row{margin:0;white-space:nowrap;font-size:.68rem !important}
      .sort-field-top select{min-width:0;min-height:32px !important;padding-inline:8px !important;border-radius:8px !important;font-size:.7rem !important}
      .filter-collapse{width:100%}
      .filter-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:34px;padding:7px 9px;border:1px solid rgba(30,41,59,.14);border-radius:8px;background:#fff;cursor:pointer;list-style:none}
      .filter-summary::-webkit-details-marker{display:none}
      .filter-summary-title{font-weight:800;font-size:.68rem}
      .filter-summary-count{font-size:.64rem;color:#64748b;white-space:nowrap}
      .filter-collapse[open] .filter-summary{border-bottom-left-radius:0;border-bottom-right-radius:0}
      .filter-collapse .checkbox-filter{max-height:230px;overflow-y:auto;overscroll-behavior:contain;padding:6px 4px 2px 0;scrollbar-width:thin}
      .filter-collapse .checkbox-filter::-webkit-scrollbar{width:8px}
      .filter-collapse .checkbox-filter::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:999px}
      .market-filter-panel .summary-item{min-height:54px !important;padding:8px 9px !important;border-radius:9px !important}
      .market-filter-panel .summary-item::before{top:8px !important;right:8px !important;width:16px !important;height:16px !important;border-radius:6px !important}
      .market-filter-panel .summary-item::after{display:none !important}
      .market-filter-panel .summary-item span{max-width:calc(100% - 18px) !important;font-size:.58rem !important;line-height:1.18 !important;letter-spacing:0 !important}
      .market-filter-panel .summary-item strong{margin-top:5px !important;font-size:1.02rem !important;letter-spacing:0 !important}
      .market-filter-panel label,.market-filter-panel .field-label,.market-filter-panel .filter-section-label{font-size:.68rem !important;letter-spacing:0 !important}
      .market-filter-panel .search-field label{font-size:.76rem !important}
      .market-filter-panel input,.market-filter-panel select,.market-filter-panel .search-field input{min-height:34px !important;padding-inline:9px !important;border-radius:9px !important;font-size:.72rem !important}
      .market-filter-panel .date-preset-row{gap:5px !important}
      .market-filter-panel .date-preset-button,.market-filter-panel .panel-actions button{min-height:28px !important;padding:0 9px !important;font-size:.66rem !important}
      .market-filter-panel .check-chip span,.market-filter-panel .cost-toggle span{min-height:23px !important;padding:0 7px !important;font-size:.63rem !important}
      .market-filter-panel .checkbox-filter{gap:4px !important;min-height:30px !important;padding:6px !important}
      .market-filter-panel #activeFilterText{min-height:27px !important;padding:5px 8px !important;font-size:.64rem !important;line-height:1.3 !important}
      .market-filter-panel .panel-actions #resetButton{display:none}
      .market-filter-panel .panel-actions .action-buttons{grid-template-columns:1fr !important}
      .top-news-card{cursor:pointer}
      .top-news-card:hover,.top-news-card:focus{transform:translateY(-1px)}
      .top-news-card[aria-expanded="true"]{border-color:rgba(19,92,155,.34);box-shadow:0 16px 30px rgba(18,40,72,.12)}
      .top-news-rank,.top-news-foot span:first-child{display:none !important}
      .top-news-badges,.featured-project-badges{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
      .top-news-badge,.featured-project-badge{display:inline-flex;align-items:center;min-height:24px;padding:3px 8px;border-radius:999px;background:#eef2ff;color:#3730a3;font-size:.74rem;font-weight:800}
      .top-news-badge.is-info,.featured-project-badge.is-stage{background:#ecfdf5;color:#047857}
      .top-news-badge.is-keyword{background:#f8fafc;color:#334155}
      .featured-project-badge.is-cost{background:#fff7ed;color:#9a3412}
      .top-news-open-hint{display:none !important}
      .top-news-card-detail{display:grid;gap:9px;margin-top:12px;padding-top:12px;border-top:1px solid rgba(42,65,97,.12)}
      .top-news-card-detail h4{margin:0;color:#0f2742;font-size:.82rem;font-weight:950;line-height:1.38}
      .top-news-card-detail p{display:block !important;max-height:none !important;margin:0;color:#44546a;font-size:.76rem;font-weight:650;line-height:1.58;overflow:visible !important;-webkit-line-clamp:unset !important;-webkit-box-orient:initial !important}
      .top-news-detail-meta{display:flex;flex-wrap:wrap;gap:6px;color:#526276;font-size:.7rem;font-weight:750}
      .top-news-detail-meta span,.top-news-detail-meta a{display:inline-flex;align-items:center;min-height:24px;padding:3px 7px;border-radius:999px;background:#f1f7ff;text-decoration:none}
      .top-news-detail-meta a{color:#1253a4;font-weight:900}
      .top-news-project-callout{align-items:flex-start;margin:0;padding:9px 10px;border-radius:9px}
      .top-news-project-callout .project-detail-link{min-height:30px;padding:0 10px;font-size:.72rem}
      @media (max-width:720px){
        .filter-top-actions{grid-template-columns:1fr;align-items:stretch}
        .sort-field-top{width:100%;margin-left:0;grid-template-columns:auto minmax(0,1fr)}
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
      const query = url.searchParams.toString();
      return `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}${query ? `?${query}` : ""}`.toLowerCase();
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

  function escapeAttribute(value) {
    return escapeHtml(value).replaceAll("`", "&#096;");
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("ko-KR").format(Number(value || 0));
  }
})();