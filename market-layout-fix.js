(() => {
  const RUN_DELAYS = [0, 120, 360, 900, 1800, 3200, 5200];
  let queued = false;
  let initialized = false;
  let expandedTopNewsId = "";

  document.addEventListener("DOMContentLoaded", init);
  if (document.readyState !== "loading") init();

  function init() {
    if (initialized) return;
    initialized = true;
    injectStyles();
    RUN_DELAYS.forEach((delay) => setTimeout(run, delay));
    ["click", "change", "input"].forEach((eventName) => document.addEventListener(eventName, queueRun, true));
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
    moveSummaryIntoFilter();
    enhanceTopNewsCards();
  }

  function moveSummaryIntoFilter() {
    const dashboard = document.querySelector(".market-dashboard");
    const panel = document.querySelector(".market-filter-panel");
    const summary = document.querySelector(".market-dashboard .summary-grid");
    if (!dashboard || !panel || !summary || panel.contains(summary)) return;
    panel.insertBefore(summary, panel.firstElementChild);
  }

  function enhanceTopNewsCards() {
    const cards = [...document.querySelectorAll("#topNewsCards .top-news-card")];
    cards.forEach((card) => {
      const row = findArticleForCard(card);
      const articleId = row?.id || normalize(card.querySelector("h3")?.textContent);
      card.dataset.topNewsArticleId = articleId;
      card.setAttribute("role", "button");
      card.tabIndex = 0;
      card.setAttribute("aria-expanded", String(expandedTopNewsId === articleId));

      if (card.dataset.marketDetailReady !== "true") {
        card.dataset.marketDetailReady = "true";
        card.addEventListener(
          "click",
          (event) => {
            const passthroughLink = event.target.closest(".top-news-source-link, .project-detail-link");
            if (passthroughLink) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            toggleTopNewsCard(card);
          },
          true,
        );
        card.addEventListener(
          "keydown",
          (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            event.stopImmediatePropagation();
            toggleTopNewsCard(card);
          },
          true,
        );
      }

      renderTopNewsDetail(card, row, expandedTopNewsId === articleId);
    });
  }

  function toggleTopNewsCard(card) {
    const articleId = card.dataset.topNewsArticleId || normalize(card.querySelector("h3")?.textContent);
    expandedTopNewsId = expandedTopNewsId === articleId ? "" : articleId;
    enhanceTopNewsCards();
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
        ${row["중요도"] ? `<span><strong>중요도</strong> ${escapeHtml(row["중요도"])}</span>` : ""}
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

  function injectStyles() {
    if (document.getElementById("marketLayoutFixStyle")) return;
    const style = document.createElement("style");
    style.id = "marketLayoutFixStyle";
    style.textContent = `
      @media (min-width: 1161px) {
        .market-dashboard {
          display: grid !important;
          width: min(1680px, 100%) !important;
          grid-template-columns: minmax(300px, 360px) minmax(0, 1fr) !important;
          align-items: start !important;
          gap: 14px !important;
          padding: 18px clamp(12px, 2vw, 28px) 34px !important;
        }

        .market-dashboard > .market-filter-panel {
          position: sticky !important;
          top: 12px !important;
          grid-column: 1 !important;
          grid-row: 1 / span 2 !important;
          align-self: start !important;
          width: auto !important;
          max-height: calc(100vh - 24px) !important;
          margin: 0 !important;
          padding: 12px !important;
          overflow-x: hidden !important;
          overflow-y: hidden !important;
          transform: none !important;
          scrollbar-gutter: stable !important;
        }

        .market-dashboard > .market-filter-panel:hover,
        .market-dashboard > .market-filter-panel:focus-within {
          overflow-y: auto !important;
        }

        .market-dashboard > .market-results-section {
          grid-column: 2 !important;
          grid-row: 1 / span 2 !important;
          min-width: 0 !important;
          margin: 0 !important;
        }

        .market-filter-panel > .summary-grid {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 6px !important;
          margin: 0 0 10px !important;
        }

        .market-filter-panel > .summary-grid .summary-item:nth-child(5) {
          grid-column: 1 / -1;
        }

        .market-filter-panel .summary-item {
          min-height: 54px !important;
          padding: 8px 9px !important;
          border-radius: 9px !important;
        }

        .market-filter-panel .summary-item::before {
          top: 8px !important;
          right: 8px !important;
          width: 16px !important;
          height: 16px !important;
          border-radius: 6px !important;
        }

        .market-filter-panel .summary-item::after {
          display: none !important;
        }

        .market-filter-panel .summary-item span {
          max-width: calc(100% - 18px) !important;
          font-size: 0.58rem !important;
          line-height: 1.18 !important;
          letter-spacing: 0 !important;
        }

        .market-filter-panel .summary-item strong {
          margin-top: 5px !important;
          font-size: 1.02rem !important;
          letter-spacing: 0 !important;
        }

        .market-filter-panel label,
        .market-filter-panel .field-label,
        .market-filter-panel .filter-section-label,
        .market-filter-panel .sort-label-row label {
          font-size: 0.68rem !important;
          letter-spacing: 0 !important;
        }

        .market-filter-panel .search-field label {
          font-size: 0.76rem !important;
        }

        .market-filter-panel input,
        .market-filter-panel select,
        .market-filter-panel .search-field input {
          min-height: 34px !important;
          padding-inline: 9px !important;
          border-radius: 9px !important;
          font-size: 0.72rem !important;
        }

        .market-filter-panel .date-preset-row {
          gap: 5px !important;
        }

        .market-filter-panel .date-preset-button,
        .market-filter-panel .panel-actions button,
        .market-filter-panel .top-reset-button {
          min-height: 28px !important;
          padding: 0 9px !important;
          font-size: 0.66rem !important;
        }

        .market-filter-panel .check-chip span,
        .market-filter-panel .cost-toggle span {
          min-height: 23px !important;
          padding: 0 7px !important;
          font-size: 0.63rem !important;
        }

        .market-filter-panel .checkbox-filter {
          gap: 4px !important;
          min-height: 30px !important;
          padding: 6px !important;
        }

        .market-filter-panel #activeFilterText {
          min-height: 27px !important;
          padding: 5px 8px !important;
          font-size: 0.64rem !important;
          line-height: 1.3 !important;
        }
      }

      .top-news-card {
        cursor: pointer;
      }

      .top-news-card[aria-expanded="true"] {
        border-color: rgba(19, 92, 155, 0.34);
        box-shadow: 0 16px 30px rgba(18, 40, 72, 0.12);
      }

      .top-news-card-detail {
        display: grid;
        gap: 9px;
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid rgba(42, 65, 97, 0.12);
      }

      .top-news-card-detail h4 {
        margin: 0;
        color: #0f2742;
        font-size: 0.82rem;
        font-weight: 950;
        line-height: 1.38;
      }

      .top-news-card-detail p {
        margin: 0;
        color: #44546a;
        font-size: 0.76rem;
        font-weight: 650;
        line-height: 1.58;
      }

      .top-news-detail-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        color: #526276;
        font-size: 0.7rem;
        font-weight: 750;
      }

      .top-news-detail-meta span,
      .top-news-detail-meta a {
        display: inline-flex;
        align-items: center;
        min-height: 24px;
        padding: 3px 7px;
        border-radius: 999px;
        background: #f1f7ff;
        text-decoration: none;
      }

      .top-news-detail-meta a {
        color: #1253a4;
        font-weight: 900;
      }

      .top-news-project-callout {
        align-items: flex-start;
        margin: 0;
        padding: 9px 10px;
        border-radius: 9px;
      }

      .top-news-project-callout .project-detail-link {
        min-height: 30px;
        padding: 0 10px;
        font-size: 0.72rem;
      }

      @media (max-width: 1160px) {
        .market-filter-panel > .summary-grid {
          margin: 0 0 12px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function normalize(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function normalizeUrl(value) {
    try {
      const url = new URL(value, window.location.href);
      url.hash = "";
      ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"].forEach((key) =>
        url.searchParams.delete(key),
      );
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
})();
