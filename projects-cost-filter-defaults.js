(() => {
  const TEN_MILLION_USD = 10_000_000;

  try {
    if (typeof CONFIG !== "undefined") {
      CONFIG.SMALL_COST_THRESHOLD_USD = TEN_MILLION_USD;
    }
  } catch (error) {
    console.warn("Failed to set project cost threshold:", error);
  }

  function setDefaultControls() {
    const smallCost = document.getElementById("includeSmallCost");
    const unknownCost = document.getElementById("includeUnknownCost");
    const activeText = document.getElementById("activeFilterText");

    if (smallCost) {
      smallCost.checked = true;
      const label = smallCost.closest("label")?.querySelector("span");
      if (label) label.textContent = "1천만불 이하 제외";
    }

    if (unknownCost) {
      unknownCost.checked = true;
      const label = unknownCost.closest("label")?.querySelector("span");
      if (label) label.textContent = "사업비 미포함 제외";
    }

    if (activeText && /1백만불|미확인 사업 포함|미확인 사업 제외|사업비 미확인/.test(activeText.textContent || "")) {
      activeText.textContent = (activeText.textContent || "")
        .replaceAll("1백만불 이하 포함", "1천만불 이하 제외")
        .replaceAll("1백만불 이하 제외", "1천만불 이하 포함")
        .replaceAll("미확인 사업 포함", "사업비 미포함 제외")
        .replaceAll("사업비 미확인 제외", "사업비 미포함 제외");
    }
  }

  function patchProjectFiltering() {
    try {
      if (typeof applyFilters !== "function" || typeof state === "undefined" || typeof els === "undefined") return;

      applyFilters = function patchedProjectApplyFilters() {
        const keyword = (els.keywordInput?.value || "").trim().toLowerCase();
        const regions = getCheckedValues(els.regionFilter);
        const countries = getCheckedValues(els.countryFilter);
        const sectors = getCheckedValues(els.sectorFilter);
        const stages = getCheckedValues(els.stageFilter);
        const excludeSmallCost = Boolean(els.includeSmallCost?.checked);
        const excludeUnknownCost = Boolean(els.includeUnknownCost?.checked);

        let projects = state.projects.filter((project) => {
          const keywordOk =
            !keyword ||
            [
              project.projectId,
              project.name,
              project.owner,
              project.representativeArticleId,
              project.representativeTopic,
              project.note,
              project.region,
              project.country,
              project.sector,
              project.stage,
            ]
              .join(" ")
              .toLowerCase()
              .includes(keyword);
          const regionOk = !regions.length || regions.includes(project.region);
          const countryOk = !countries.length || countries.includes(project.country);
          const sectorOk = !sectors.length || sectors.includes(project.sector);
          const stageOk = !stages.length || stages.includes(project.stage);
          const unknownCostOk = !excludeUnknownCost || project.costKnown;
          const smallCostOk = !excludeSmallCost || !isSmallCost(project);
          return keywordOk && regionOk && countryOk && sectorOk && stageOk && unknownCostOk && smallCostOk;
        });

        projects = sortProjects(projects, els.sortSelect?.value || "cost:desc");
        state.filteredProjects = projects;
        updateSummary();
        renderFeaturedProjects();
        renderProjects();
        updateActiveFilterText();
      };

      updateActiveFilterText = function patchedProjectActiveFilterText() {
        const filters = [];
        if (els.keywordInput?.value?.trim()) filters.push(`검색: ${els.keywordInput.value.trim()}`);
        pushSelectedFilter(filters, "지역", getCheckedValues(els.regionFilter));
        pushSelectedFilter(filters, "국가", getCheckedValues(els.countryFilter));
        pushSelectedFilter(filters, "섹터", getCheckedValues(els.sectorFilter));
        pushSelectedFilter(filters, "단계", getCheckedValues(els.stageFilter));
        filters.push(els.includeSmallCost?.checked ? "1천만불 이하 제외" : "1천만불 이하 포함");
        filters.push(els.includeUnknownCost?.checked ? "사업비 미포함 제외" : "사업비 미포함 포함");
        els.activeFilterText.textContent = filters.join(" · ");
      };
    } catch (error) {
      console.warn("Failed to patch project filters:", error);
    }
  }

  function reinforceDefaultsAfterReset() {
    const resetButton = document.getElementById("resetButton");
    if (!resetButton || resetButton.dataset.costDefaultsReady === "true") return;
    resetButton.dataset.costDefaultsReady = "true";
    resetButton.addEventListener("click", () => {
      window.setTimeout(() => {
        setDefaultControls();
        if (typeof applyFilters === "function") applyFilters();
      }, 80);
    });
  }

  setDefaultControls();
  patchProjectFiltering();

  document.addEventListener("DOMContentLoaded", () => {
    setDefaultControls();
    reinforceDefaultsAfterReset();
  });
})();
