(() => {
  const ensureBadgeStyles = () => {
    if (document.querySelector('link[data-card-badge-fix="true"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "./card-badge-fix.css?v=20260623-1";
    link.dataset.cardBadgeFix = "true";
    document.head.appendChild(link);
  };

  ensureBadgeStyles();

  const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  const loose = (value) => normalize(value).replace(/[\s\-_/.,:|()[\]{}'\"]/g, "");

  const originalFindProject = typeof findProject === "function" ? findProject : null;
  const originalBuildArticleItems = typeof buildArticleItems === "function" ? buildArticleItems : null;

  window.findProject = function findProjectRobust(projectRows, criteria) {
    const id = normalize(criteria.projectId);
    const name = normalize(criteria.projectName);
    const looseName = loose(criteria.projectName);
    const country = normalize(criteria.country);
    const sector = normalize(criteria.sector);

    if (id) {
      const byId = projectRows.find((row) => normalize(row["프로젝트 고유값"]) === id);
      if (byId) return byId;
    }

    if (name) {
      const exactName = projectRows.find((row) => {
        const rowName = normalize(row["프로젝트명"]);
        const countryOk = !country || normalize(row["국가"]) === country;
        return rowName === name && countryOk;
      });
      if (exactName) return exactName;
    }

    if (looseName) {
      const looseMatch = projectRows.find((row) => {
        const rowName = loose(row["프로젝트명"]);
        const countryOk = !country || normalize(row["국가"]) === country;
        const sectorOk = !sector || normalize(row["섹터"]) === sector;
        return rowName && (rowName === looseName || rowName.includes(looseName) || looseName.includes(rowName)) && countryOk && sectorOk;
      });
      if (looseMatch) return looseMatch;
    }

    if (originalFindProject) return originalFindProject(projectRows, criteria);
    return null;
  };

  window.buildArticleItems = function buildArticleItemsRobust(project, resultRows = []) {
    const baseItems = originalBuildArticleItems ? originalBuildArticleItems(project, resultRows) : [];
    const seen = new Set(baseItems.map((item) => item.article?.["기사 고유값"]).filter(Boolean));
    const projectId = normalize(project["프로젝트 고유값"]);
    const projectName = normalize(project["프로젝트명"]);
    const looseProjectName = loose(project["프로젝트명"]);
    const country = normalize(project["국가"]);
    const sector = normalize(project["섹터"]);
    const representativeArticleId = project["대표 기사 고유값"];

    resultRows.forEach((article, index) => {
      const articleId = article["기사 고유값"] || `fallback-${index}`;
      if (seen.has(articleId)) return;

      const idMatch = projectId && normalize(article["프로젝트 고유값"]) === projectId;
      const representativeMatch = representativeArticleId && articleId === representativeArticleId;
      const articleName = normalize(article["프로젝트명"]);
      const looseArticleName = loose(article["프로젝트명"]);
      const nameMatch = projectName && articleName === projectName;
      const looseNameMatch = looseProjectName && looseArticleName && (looseArticleName === looseProjectName || looseArticleName.includes(looseProjectName) || looseProjectName.includes(looseArticleName));
      const countryOk = !country || normalize(article["국가"]) === country;
      const sectorOk = !sector || normalize(article["섹터"]) === sector;

      if (!(idMatch || representativeMatch || ((nameMatch || looseNameMatch) && countryOk && sectorOk))) return;

      seen.add(articleId);
      baseItems.push({
        mapping: {
          "기사 고유값": articleId,
          "기사일자": article["원문게재일"] || project["최근 업데이트일"],
          "기사 시점 단계": article["관련 단계"] || project["현재 단계"],
          "해당 기사 기준 사업비": project["사업비(달러 기준 추정액)"],
          "대표기사 여부": representativeMatch ? "Y" : "",
        },
        article,
      });
    });

    if (typeof collapseDuplicateArticleItems === "function") return collapseDuplicateArticleItems(baseItems);
    return baseItems;
  };
})();
