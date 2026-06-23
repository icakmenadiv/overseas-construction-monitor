(() => {
  window.buildProjectDetailUrl = function buildProjectDetailUrlWithId(row) {
    const params = new URLSearchParams();
    if (row["프로젝트 고유값"]) params.set("id", row["프로젝트 고유값"]);
    if (row["프로젝트명"]) params.set("name", row["프로젝트명"]);
    if (row["국가"]) params.set("country", row["국가"]);
    if (row["섹터"]) params.set("sector", row["섹터"]);
    return `./project.html?${params.toString()}`;
  };

  if (typeof createTopNewsCard !== "function") return;

  window.createTopNewsCard = function createTopNewsCardWithBadges(row, rank) {
    const article = document.createElement("article");
    article.className = "top-news-card";
    const title = row["제목(한글)"] || row["제목(원문)"] || "제목 없음";
    const score = typeof getImportanceScore === "function" ? getImportanceScore(row["중요도"]) : -1;
    const importanceLabel = score >= 0 ? row["중요도"] || score : "-";
    const titleMarkup = row["출처링크"]
      ? `<a href="${escapeAttribute(row["출처링크"])}" target="_blank" rel="noreferrer">${escapeHtml(title)}</a>`
      : `<span>${escapeHtml(title)}</span>`;
    const projectLink = row["프로젝트명"] ? buildProjectDetailUrlWithId(row) : "";

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
        ${row["프로젝트명"] ? `<a class="card-badge card-badge-project" href="${escapeAttribute(projectLink)}">프로젝트 상세</a>` : ""}
      </div>
      <div class="top-news-foot">
        <span>중요도 ${escapeHtml(importanceLabel)}</span>
        <span>${escapeHtml(formatDate(row._publishedDate) || row["원문게재일"] || "-")}</span>
      </div>
    `;
    return article;
  };
})();
