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

    // Legacy links may only have name/country/sector. Use them only to find the project row;
    // related articles below are still connected strictly by the resolved project ID.
    if (name) {
      const exactName = projectRows.find((row) => {
        const rowName = normalize(row["프로젝트명"]);
        const countryOk = !country || normalize(row["국가"]) === country;
        const sectorOk = !sector || normalize(row["섹터"]) === sector;
        return rowName === name && countryOk && sectorOk;
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

  window.buildArticleItems = function buildArticleItemsByProjectId(project, resultRows = []) {
    const projectId = normalize(project["프로젝트 고유값"]);
    const representativeArticleId = project["대표 기사 고유값"];
    const seen = new Set();
    const items = [];

    if (!projectId) return items;

    resultRows.forEach((article) => {
      const articleId = article["기사 고유값"];
      if (!articleId || seen.has(articleId)) return;
      if (normalize(article["프로젝트 고유값"]) !== projectId) return;

      seen.add(articleId);
      items.push({
        mapping: {
          "기사 고유값": articleId,
          "기사일자": article["원문게재일"] || project["최근 업데이트일"],
          "기사 시점 단계": article["관련 단계"] || project["현재 단계"],
          "해당 기사 기준 사업비": project["사업비(달러 기준 추정액)"],
          "대표기사 여부": articleId === representativeArticleId ? "Y" : "",
        },
        article,
      });
    });

    if (typeof collapseDuplicateArticleItems === "function") return collapseDuplicateArticleItems(items);
    return items.sort(
      (a, b) =>
        (window.parseSheetDate?.(b.mapping?.["기사일자"])?.getTime() || 0) -
        (window.parseSheetDate?.(a.mapping?.["기사일자"])?.getTime() || 0),
    );
  };
})();
