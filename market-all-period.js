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

  document.addEventListener("DOMContentLoaded", initAllPeriodPreset);
})();
