(() => {
  const FILTER_IDS = ["regionFilter", "countryFilter", "sectorFilter", "infoClassFilter"];

  function initMarketFilterToggle() {
    if (!document.querySelector(".market-dashboard")) return;
    installDefaultAllSelectedBehavior();
    installSingleToggleButtons();
    installResetAllSelectedBehavior();
  }

  function installDefaultAllSelectedBehavior() {
    FILTER_IDS.forEach((id) => {
      const container = document.getElementById(id);
      if (!container || container.dataset.defaultAllObserverReady === "true") return;
      container.dataset.defaultAllObserverReady = "true";

      const applyDefault = () => {
        if (container.dataset.defaultAllApplied === "true") return;
        const inputs = [...container.querySelectorAll('input[type="checkbox"]')];
        if (!inputs.length) return;
        if (inputs.some((input) => input.checked)) {
          container.dataset.defaultAllApplied = "true";
          updateNearestSummary(container);
          return;
        }
        setAll(container, true);
        container.dataset.defaultAllApplied = "true";
      };

      applyDefault();
      new MutationObserver(() => window.setTimeout(applyDefault, 0)).observe(container, {
        childList: true,
        subtree: true,
      });
    });
  }

  function installSingleToggleButtons() {
    if (document.body.dataset.marketSingleToggleReady !== "true") {
      document.body.dataset.marketSingleToggleReady = "true";
      document.addEventListener(
        "click",
        (event) => {
          const button = event.target.closest(".market-dashboard .filter-mini-actions button");
          if (!button) return;

          event.preventDefault();
          event.stopPropagation();
          if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();

          const details = button.closest(".filter-collapse");
          const container = details?.querySelector(".checkbox-filter");
          if (!container || !FILTER_IDS.includes(container.id)) return;

          const inputs = [...container.querySelectorAll('input[type="checkbox"]')];
          const allSelected = inputs.length > 0 && inputs.every((input) => input.checked);
          setAll(container, !allSelected);
          updateNearestSummary(container);
        },
        true,
      );
    }

    normalizeMiniActions();
    if (document.body.dataset.marketMiniActionObserverReady !== "true") {
      document.body.dataset.marketMiniActionObserverReady = "true";
      new MutationObserver(() => window.setTimeout(normalizeMiniActions, 0)).observe(document.body, {
        childList: true,
        subtree: true,
      });
    }
  }

  function normalizeMiniActions() {
    document.querySelectorAll(".market-dashboard .filter-mini-actions").forEach((actions) => {
      if (actions.dataset.singleToggleReady === "true") return;
      const buttons = [...actions.querySelectorAll("button")];
      if (!buttons.length) return;
      const main = buttons[0];
      main.textContent = "전체선택/해제";
      main.dataset.filterAction = "toggle-all";
      buttons.slice(1).forEach((button) => button.remove());
      actions.dataset.singleToggleReady = "true";
    });
  }

  function installResetAllSelectedBehavior() {
    const resetButton = document.getElementById("resetButton");
    if (!resetButton || resetButton.dataset.marketAllSelectedResetReady === "true") return;
    resetButton.dataset.marketAllSelectedResetReady = "true";
    resetButton.addEventListener("click", () => {
      window.setTimeout(() => {
        FILTER_IDS.forEach((id) => {
          const container = document.getElementById(id);
          if (container) setAll(container, true);
        });
        if (typeof window.applyFilters === "function") window.applyFilters();
      }, 40);
    });
  }

  function setAll(container, checked) {
    container.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      input.checked = checked;
    });
    container.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function updateNearestSummary(container) {
    const details = container.closest(".filter-collapse");
    const summary = details?.querySelector(".filter-summary");
    if (!summary) return;
    const inputs = [...container.querySelectorAll('input[type="checkbox"]')];
    const checked = inputs.filter((input) => input.checked);
    if (!checked.length) {
      summary.textContent = "전체";
      summary.classList.remove("has-active-filter");
      details.classList.remove("has-active-filter");
      return;
    }
    if (checked.length === inputs.length) {
      summary.textContent = "전체 선택";
    } else {
      const firstLabel = checked[0].closest("label")?.textContent.trim() || checked[0].value;
      summary.textContent = checked.length === 1 ? firstLabel : `${firstLabel} 외 ${checked.length - 1}`;
    }
    summary.classList.add("has-active-filter");
    details.classList.add("has-active-filter");
  }

  document.addEventListener("DOMContentLoaded", () => {
    window.setTimeout(initMarketFilterToggle, 0);
    window.setTimeout(initMarketFilterToggle, 300);
  });
})();
