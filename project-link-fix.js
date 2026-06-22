(() => {
  function isProjectArticlePatched(row) {
    return Boolean(row?.["프로젝트 고유값"] || row?.["프로젝트명"] || row?.["정보 분류"] === "프로젝트 정보");
  }

  function buildProjectDetailUrlPatched(row) {
    const params = new URLSearchParams();
    if (row?.["프로젝트 고유값"]) params.set("id", row["프로젝트 고유값"]);
    if (row?.["프로젝트명"]) params.set("name", row["프로젝트명"]);
    if (row?.["국가"]) params.set("country", row["국가"]);
    if (row?.["섹터"]) params.set("sector", row["섹터"]);
    return `./project.html?${params.toString()}`;
  }

  window.isProjectArticle = isProjectArticlePatched;
  window.buildProjectDetailUrl = buildProjectDetailUrlPatched;
})();
