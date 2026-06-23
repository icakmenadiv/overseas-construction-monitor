(() => {
  const ensureBadgeStyles = () => {
    if (document.querySelector('link[data-card-badge-fix="true"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "./card-badge-fix.css?v=20260623-1";
    link.dataset.cardBadgeFix = "true";
    document.head.appendChild(link);
  };

  const applyHeaderCopy = () => {
    const eyebrow = document.querySelector(".brand-wrap .eyebrow");
    const title = document.querySelector(".brand-wrap h1");
    const subtitle = document.querySelector(".brand-wrap .subtitle");
    const navLinks = document.querySelectorAll(".page-nav a");

    if (eyebrow) eyebrow.textContent = "Market News";
    if (title) title.textContent = "해외 건설시장 뉴스";
    if (subtitle) subtitle.textContent = "주요 건설·인프라 시장뉴스를 필터로 확인합니다.";
    if (navLinks[0]) navLinks[0].textContent = "해외 건설시장 뉴스";
    if (navLinks[1]) navLinks[1].textContent = "프로젝트 목록";
  };

  const patchMarketProjectDetailLinks = () => {
    window.isProjectArticle = function isProjectArticlePatched(row) {
      return Boolean(
        row?.["프로젝트 고유값"] ||
          row?.["프로젝트명"] ||
          String(row?.["정보 분류"] || "").includes("프로젝트"),
      );
    };

    window.buildProjectDetailUrl = function buildProjectDetailUrlPatched(row) {
      const params = new URLSearchParams();
      if (row?.["프로젝트 고유값"]) params.set("id", row["프로젝트 고유값"]);
      if (row?.["프로젝트명"]) params.set("name", row["프로젝트명"]);
      if (row?.["국가"]) params.set("country", row["국가"]);
      if (row?.["섹터"]) params.set("sector", row["섹터"]);
      return `./project.html?${params.toString()}`;
    };
  };

  const patchTopNewsCards = () => {
    if (typeof createTopNewsCard !== "function" || window.__marketCardBadgePatchApplied) return;
    window.__marketCardBadgePatchApplied = true;

    window.createTopNewsCard = function createTopNewsCardPatched(row, rank) {
      const article = document.createElement("article");
      article.className = "top-news-card";
      const title = row["제목(한글)"] || row["제목(원문)"] || "제목 없음";
      const score = typeof getImportanceScore === "function" ? getImportanceScore(row["중요도"]) : -1;
      const importanceLabel = score >= 0 ? row["중요도"] || score : "-";
      const titleMarkup = row["출처링크"]
        ? `<a href="${escapeAttribute(row["출처링크"])}" target="_blank" rel="noreferrer">${escapeHtml(title)}</a>`
        : `<span>${escapeHtml(title)}</span>`;
      const projectUrl = row["프로젝트명"] || row["프로젝트 고유값"] ? window.buildProjectDetailUrl(row) : "";

      article.innerHTML = `
        <div class="top-news-meta">
          <span class="top-news-rank">TOP ${rank}</span>
          <span>${escapeHtml(row["국가"] || "-")}</span>
          <span>${escapeHtml(row["섹터"] || "-")}</span>
        </div>
        <h3>${titleMarkup}</h3>
        <div class="card-badge-row" aria-label="기사 분류와 키워드">
          ${row["정보 분류"] ? `<span class="card-badge card-badge-info">${escapeHtml(row["정보 분류"])}</span>` : ""}
          ${row["주제"] ? `<span class="card-badge card-badge-topic">${escapeHtml(row["주제"])}</span>` : ""}
          ${projectUrl ? `<a class="card-badge card-badge-project" href="${escapeAttribute(projectUrl)}">프로젝트 상세</a>` : ""}
        </div>
        <div class="top-news-foot">
          <span>중요도 ${escapeHtml(importanceLabel)}</span>
          <span>${escapeHtml(formatDate(row._publishedDate) || row["원문게재일"] || "-")}</span>
        </div>
      `;
      return article;
    };
  };

  const applyAll = () => {
    ensureBadgeStyles();
    applyHeaderCopy();
    patchMarketProjectDetailLinks();
    patchTopNewsCards();
  };

  applyAll();
  document.addEventListener("DOMContentLoaded", applyAll);
  window.addEventListener("load", applyAll);
  setTimeout(applyAll, 300);
  setTimeout(applyAll, 1000);
})();
