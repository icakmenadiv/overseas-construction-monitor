(() => {
  document.addEventListener("DOMContentLoaded", init);
  if (document.readyState !== "loading") init();

  function init() {
    patchAllPeriodButton();
    patchApplyFilters();
  }

  function patchAllPeriodButton() {
    document.addEventListener(
      "click",
      (event) => {
        const target = event.target.closest('[data-period="all"]');
        if (!target) return;

        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();

        const startDate = document.getElementById("startDate");
        const endDate = document.getElementById("endDate");
        if (startDate) startDate.value = "";
        if (endDate) endDate.value = "";

        document.querySelectorAll(".date-preset-button").forEach((preset) => {
          const active = preset === target;
          preset.classList.toggle("is-active", active);
          preset.setAttribute("aria-pressed", String(active));
        });

        if (window.state?.expanded?.clear) window.state.expanded.clear();
        if (typeof window.applyFilters === "function") window.applyFilters();
      },
      true,
    );
  }

  function patchApplyFilters() {
    const tryPatch = () => {
      if (typeof window.applyFilters !== "function" || typeof window.state !== "object" || typeof window.els !== "object") {
        setTimeout(tryPatch, 100);
        return;
      }

      window.applyFilters = applyFiltersRobust;
    };
    tryPatch();
  }

  function applyFiltersRobust() {
    const keyword = (els.keywordInput?.value || "").trim().toLowerCase();
    const start = els.startDate?.value ? new Date(`${els.startDate.value}T00:00:00`) : null;
    const end = els.endDate?.value ? new Date(`${els.endDate.value}T23:59:59`) : null;
    const regions = getCheckedValuesSafe(els.regionFilter);
    const countries = getCheckedValuesSafe(els.countryFilter);
    const sectors = getCheckedValuesSafe(els.sectorFilter);
    const infoClasses = getCheckedValuesSafe(els.infoClassFilter);

    let rows = state.rows.filter((row) => {
      const date = row._publishedDate || parseDateSafe(row["원문게재일"]) || row._collectedDate || parseDateSafe(row["기사수집일"]);
      const dateOk = (!start && !end) || ((!start || (date && date >= start)) && (!end || (date && date <= end)));
      const regionOk = !regions.length || regions.includes(row["지역"]);
      const countryOk = !countries.length || countries.includes(row["국가"]);
      const sectorOk = !sectors.length || sectors.includes(row["섹터"]);
      const infoClassOk = !infoClasses.length || infoClasses.includes(row["정보 분류"]);
      const priorityOk = !state.highPriorityOnly || isHighPrioritySafe(row);
      const keywordOk = !keyword || searchableText(row).includes(keyword);
      return dateOk && regionOk && countryOk && sectorOk && infoClassOk && priorityOk && keywordOk;
    });

    rows = sortRowsSafe(rows, els.sortSelect?.value || "중요도:desc");
    state.filteredRows = rows;
    state.expanded?.forEach?.((id) => {
      if (!rows.some((row) => row.id === id)) state.expanded.delete(id);
    });
    updateSummary?.();
    renderTopNewsCards?.();
    renderRows?.();
    updateActiveFilterText?.();
    syncDatePresetButtons?.();
    saveFilterState?.();
  }

  function searchableText(row) {
    const keys = [
      "기사 고유값",
      "프로젝트 고유값",
      "프로젝트명",
      "제목(한글)",
      "제목(원문)",
      "내용",
      "국가",
      "지역",
      "섹터",
      "주제",
      "정보 분류",
      "관련 단계",
      "출처언어",
      "출처링크",
      "원문게재일",
      "기사수집일",
    ];
    return keys.map((key) => String(row[key] || "")).join(" ").toLowerCase();
  }

  function getCheckedValuesSafe(container) {
    if (!container) return [];
    return [...container.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value);
  }

  function isHighPrioritySafe(row) {
    const value = String(row["중요도"] || "").trim();
    if (value === "상") return true;
    const number = value.match(/-?\d+(?:\.\d+)?/);
    if (number) return Number(number[0]) >= 80;
    return /상|높|high|중요|우선/.test(value.toLowerCase());
  }

  function sortRowsSafe(rows, sortValue) {
    if (typeof window.sortRows === "function") return window.sortRows(rows, sortValue);
    return rows;
  }

  function parseDateSafe(value) {
    if (typeof window.parseSheetDate === "function") return window.parseSheetDate(value);
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
})();
