(() => {
  const originalAddEventListener = document.addEventListener.bind(document);
  let capturedProjectInit = null;

  document.addEventListener = function patchedAddEventListener(type, listener, options) {
    if (type === "DOMContentLoaded" && typeof listener === "function" && listener.name === "init") {
      capturedProjectInit = listener;
      return undefined;
    }
    return originalAddEventListener(type, listener, options);
  };

  const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

  const projectFromArticle = (article, criteria) => ({
    id: "fallback-project",
    "프로젝트 고유값": clean(article["프로젝트 고유값"] || criteria.projectId),
    "프로젝트명": clean(article["프로젝트명"] || criteria.projectName || criteria.projectId),
    "지역": clean(article["지역"]),
    "국가": clean(article["국가"] || criteria.country),
    "섹터": clean(article["섹터"] || criteria.sector),
    "발주처": "-",
    "사업비(달러 기준 추정액)": "사업비 미확인",
    "사업비 환산 환율 / 기준": "-",
    "현재 단계": clean(article["관련 단계"]),
    "최근 업데이트일": clean(article["원문게재일"]),
    "대표 기사 고유값": clean(article["기사 고유값"]),
    "비고": "프로젝트 탭 기준행이 없어 결과 탭 기사 기준으로 표시",
    "대표 기사 정보 분류": clean(article["정보 분류"] || "프로젝트 정보"),
  });

  async function initProjectDetailById() {
    if (els?.backToTopButton) {
      els.backToTopButton.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    try {
      const params = new URLSearchParams(window.location.search);
      const criteria = {
        projectName: clean(params.get("name")),
        country: clean(params.get("country")),
        sector: clean(params.get("sector")),
        projectId: clean(params.get("id")),
      };

      const [projectRows, resultRows] = await Promise.all([
        fetchAndNormalize(CONFIG.PROJECT_SHEET_GID, PROJECT_COLUMNS),
        fetchAndNormalize(CONFIG.RESULT_SHEET_GID, RESULT_COLUMNS),
      ]);

      let project = findProject(projectRows, criteria);
      if (!project && criteria.projectId) {
        const article = resultRows.find((row) => clean(row["프로젝트 고유값"]) === criteria.projectId);
        if (article) project = projectFromArticle(article, criteria);
      }

      if (!project) {
        showEmpty(criteria.projectId || criteria.projectName || criteria.country || criteria.sector || "프로젝트 정보 없음");
        return;
      }

      const articles = buildArticleItems(project, resultRows);
      renderProject(project, articles);
      els.syncStatus.textContent = `마지막 불러오기 ${formatDateTime(new Date())}`;
    } catch (error) {
      console.error("Project fetch error:", error);
      if (capturedProjectInit) {
        try {
          await capturedProjectInit();
          return;
        } catch (fallbackError) {
          console.error("Original project init fallback failed:", fallbackError);
        }
      }
      showError();
    }
  }

  originalAddEventListener("DOMContentLoaded", initProjectDetailById);
})();
