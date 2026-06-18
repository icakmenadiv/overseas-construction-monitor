(() => {
  const TEN_MILLION_USD = 10_000_000;

  function getProjectBindings() {
    try {
      return {
        hasBindings: typeof state !== "undefined" && typeof els !== "undefined",
        state,
        els,
      };
    } catch (error) {
      return { hasBindings: false, state: null, els: null };
    }
  }

  function setLabelsAndDefaults() {
    const smallCost = document.getElementById("includeSmallCost");
    const unknownCost = document.getElementById("includeUnknownCost");
    const activeText = document.getElementById("activeFilterText");

    if (smallCost) {
      smallCost.checked = true;
      smallCost.setAttribute("aria-label", "1천만불 이하 제외");
      const label = smallCost.closest("label")?.querySelector("span");
      if (label) label.textContent = "1천만불 이하 제외";
    }

    if (unknownCost) {
      unknownCost.checked = true;
      unknownCost.setAttribute("aria-label", "사업비 미포함 제외");
      const label = unknownCost.closest("label")?.querySelector("span");
      if (label) label.textContent = "사업비 미포함 제외";
    }

    if (activeText) activeText.textContent = "1천만불 이하 제외 · 사업비 미포함 제외";
  }

  function isExcludedByCost(project, excludeSmall, excludeUnknown) {
    const costKnown = Boolean(project?.costKnown);
    const costValue = Number(project?.costValue || 0);
    if (excludeUnknown && !costKnown) return true;
    if (excludeSmall && costKnown && costValue <= TEN_MILLION_USD) return true;
    return false;
  }

  function patchProjectFiltering() {
    const bindings = getProjectBindings();
    if (!bindings.hasBindings) return false;
    const { state, els } = bindings;

    try {
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
          const costOk = !isExcludedByCost(project, excludeSmallCost, excludeUnknownCost);
          return keywordOk && regionOk && countryOk && sectorOk && stageOk && costOk;
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

      isSmallCost = function patchedIsSmallCost(project) {
        return Boolean(project?.costKnown) && Number(project?.costValue || 0) <= TEN_MILLION_USD;
      };

      return true;
    } catch (error) {
      console.warn("Failed to patch project cost filters:", error);
      return false;
    }
  }

  function bindControls() {
    const smallCost = document.getElementById("includeSmallCost");
    const unknownCost = document.getElementById("includeUnknownCost");
    [smallCost, unknownCost].forEach((input) => {
      if (!input || input.dataset.costPatchReady === "true") return;
      input.dataset.costPatchReady = "true";
      input.addEventListener("change", () => {
        patchProjectFiltering();
        if (typeof applyFilters === "function") applyFilters();
      });
    });

    const resetButton = document.getElementById("resetButton");
    if (resetButton && resetButton.dataset.costDefaultsReady !== "true") {
      resetButton.dataset.costDefaultsReady = "true";
      resetButton.addEventListener("click", () => {
        window.setTimeout(() => {
          setLabelsAndDefaults();
          patchProjectFiltering();
          if (typeof applyFilters === "function") applyFilters();
        }, 80);
      });
    }
  }

  function initCostPatch() {
    setLabelsAndDefaults();
    patchProjectFiltering();
    bindControls();
    window.setTimeout(() => {
      setLabelsAndDefaults();
      patchProjectFiltering();
      if (typeof applyFilters === "function") applyFilters();
    }, 250);
  }

  initCostPatch();
  document.addEventListener("DOMContentLoaded", initCostPatch);
})();
