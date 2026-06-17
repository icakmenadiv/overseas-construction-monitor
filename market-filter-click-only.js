(() => {
  function initClickOnlyMarketFilters() {
    if (!document.querySelector(".market-dashboard")) return;

    document.querySelectorAll(".market-dashboard .filter-collapse").forEach((details) => {
      if (details.dataset.clickOnlyReady === "true") return;
      details.dataset.clickOnlyReady = "true";

      ["mouseenter", "mouseleave"].forEach((eventName) => {
        details.addEventListener(
          eventName,
          (event) => {
            event.stopImmediatePropagation();
          },
          true,
        );
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    window.setTimeout(initClickOnlyMarketFilters, 0);
  });
})();
