(function () {
  const originalBuildProjectUrl = buildProjectUrl;

  buildProjectUrl = function buildProjectUrlWithId(project) {
    const params = new URLSearchParams();
    if (project.projectId) params.set("id", project.projectId);
    params.set("name", project.name);
    if (project.country) params.set("country", project.country);
    if (project.sector) params.set("sector", project.sector);
    return `./project.html?${params.toString()}`;
  };

  applyFilters = function applyProjectFiltersWithNotes() {
    const keyword = (els.keywordInput?.value || "").trim().toLowerCase();
    const regions = getCheckedValues(els.regionFilter);
    const countries = getCheckedValues(els.countryFilter);
    const sectors = getCheckedValues(els.sectorFilter);
    const stages = getCheckedValues(els.stageFilter);
    const includeSmallCost = Boolean(els.includeSmallCost?.checked);
    const includeUnknownCost = Boolean(els.includeUnknownCost?.checked);

    let projects = state.projects.filter((project) => {
      const keywordOk =
        !keyword ||
        [
          project.projectId,
          project.name,
          project.owner,
          project.representativeArticleId,
          project.representativeTopic,
          project.region,
          project.country,
          project.sector,
          project.stage,
          project.note,
        ]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      const regionOk = !regions.length || regions.includes(project.region);
      const countryOk = !countries.length || countries.includes(project.country);
      const sectorOk = !sectors.length || sectors.includes(project.sector);
      const stageOk = !stages.length || stages.includes(project.stage);
      const unknownCostOk = project.costKnown || includeUnknownCost;
      const smallCostOk = !isSmallCost(project) || includeSmallCost;
      return keywordOk && regionOk && countryOk && sectorOk && stageOk && unknownCostOk && smallCostOk;
    });

    projects = sortProjects(projects, els.sortSelect?.value || "cost:desc");
    state.filteredProjects = projects;
    updateSummary();
    renderFeaturedProjects();
    renderProjects();
    updateActiveFilterText();
  };

  document.addEventListener("DOMContentLoaded", () => {
    if (els.includeSmallCost) els.includeSmallCost.checked = true;
    if (els.includeUnknownCost) els.includeUnknownCost.checked = true;

    if (els.resetButton) {
      els.resetButton.addEventListener("click", () => {
        window.setTimeout(() => {
          if (els.includeSmallCost) els.includeSmallCost.checked = true;
          if (els.includeUnknownCost) els.includeUnknownCost.checked = true;
          applyFilters();
        }, 0);
      });
    }
  });
})();
