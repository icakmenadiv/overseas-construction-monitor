(() => {
  function initAllPeriodPreset() {
    const button = document.querySelector('[data-period="all"]');
    if (!button) return;

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
        const earliestDate = getEarliestPublishedDate();
        const today = new Date();

        if (startDate) startDate.value = earliestDate ? toDateInputValue(earliestDate) : "";
        if (endDate) endDate.value = toDateInputValue(today);

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

  function getEarliestPublishedDate() {
    const rows = Array.isArray(window.state?.rows) ? window.state.rows : [];
    const dates = rows
      .map((row) => row._publishedDate)
      .filter((date) => date instanceof Date && !Number.isNaN(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    return dates[0] || null;
  }

  function toDateInputValue(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  document.addEventListener("DOMContentLoaded", initAllPeriodPreset);
})();
