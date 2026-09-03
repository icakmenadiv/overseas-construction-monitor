(() => {
  const SMALL_COST_EXCLUDE_THRESHOLD_USD = 10_000_000;

  document.addEventListener("DOMContentLoaded", () => {
    patchProjectCostFilterSemantics();
  });

  function patchProjectCostFilterSemantics() {
    if (typeof applyFilters !== "function" || typeof state === "undefined" || typeof els === "undefined") {
      setTimeout(patchProjectCostFilterSemantics, 100);
      return;
    }

    applyFilters = function applyFiltersWithExcludeSemantics() {
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
        const smallCostOk = !excludeSmallCost || !isSmallCostForExclude(project);
        return keywordOk && regionOk && countryOk && sectorOk && stageOk && unknownCostOk && smallCostOk;
      });

      projects = sortProjects(projects, els.sortSelect?.value || "cost:desc");
      state.filteredProjects = projects;
      updateSummary();
      renderFeaturedProjects();
      renderProjects();
      updateActiveFilterText();
    };

    updateActiveFilterText = function updateActiveFilterTextWithExcludeSemantics() {
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

    installFilterEventOverride();
    applyFilters();
  }

  function installFilterEventOverride() {
    const debouncedApply = debounce(() => applyFilters(), 180);

    if (els.keywordInput && !els.keywordInput.dataset.excludeSemanticsPatched) {
      els.keywordInput.dataset.excludeSemanticsPatched = "true";
      els.keywordInput.addEventListener(
        "input",
        (event) => {
          event.stopImmediatePropagation();
          debouncedApply();
        },
        true,
      );
    }

    if (els.sortSelect && !els.sortSelect.dataset.excludeSemanticsPatched) {
      els.sortSelect.dataset.excludeSemanticsPatched = "true";
      els.sortSelect.addEventListener(
        "input",
        (event) => {
          event.stopImmediatePropagation();
          debouncedApply();
        },
        true,
      );
      els.sortSelect.addEventListener(
        "change",
        (event) => {
          event.stopImmediatePropagation();
          debouncedApply();
        },
        true,
      );
    }

    [els.includeSmallCost, els.includeUnknownCost, els.countryFilter, els.sectorFilter, els.stageFilter].forEach((element) => {
      if (!element || element.dataset.excludeSemanticsPatched) return;
      element.dataset.excludeSemanticsPatched = "true";
      element.addEventListener(
        "change",
        (event) => {
          event.stopImmediatePropagation();
          applyFilters();
        },
        true,
      );
    });

    if (els.regionFilter && !els.regionFilter.dataset.excludeSemanticsPatched) {
      els.regionFilter.dataset.excludeSemanticsPatched = "true";
      els.regionFilter.addEventListener(
        "change",
        (event) => {
          event.stopImmediatePropagation();
          updateCountryOptions();
          applyFilters();
        },
        true,
      );
    }
  }

  function isSmallCostForExclude(project) {
    return project.costKnown && Number(project.costValue || 0) <= SMALL_COST_EXCLUDE_THRESHOLD_USD;
  }

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }
})();
