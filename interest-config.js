// Anonymous interest-heart feature configuration.
//
// Production mode:
// - INTEREST_FEATURE_ENABLED true shows hearts on normal site URLs.
// - INTEREST_API_ENDPOINT stores and reads shared counts through Cloudflare Worker + D1.

window.INTEREST_FEATURE_ENABLED = true;
window.INTEREST_API_ENDPOINT = "https://icak-interest-api.icak-mena-div.workers.dev";

(() => {
  const params = new URLSearchParams(window.location.search);
  const previewEnabled = params.get("interest") === "1";
  const shouldPolish = Boolean(window.INTEREST_FEATURE_ENABLED) || previewEnabled;
  if (!shouldPolish) return;

  let runTimer = null;
  let observersInstalled = false;

  const run = () => {
    window.InterestFeature?.enhanceAll?.();
    polishMarketInterestColumn();
  };

  const queueRun = (delay = 80) => {
    clearTimeout(runTimer);
    runTimer = setTimeout(run, delay);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", schedule);
  } else {
    schedule();
  }

  function schedule() {
    [80, 180, 420, 900, 1600, 2600].forEach((delay) => setTimeout(run, delay));
    installRenderObservers();
    document.addEventListener("click", () => {
      queueRun(40);
      setTimeout(run, 180);
      setTimeout(run, 520);
    });
    document.addEventListener("input", () => queueRun(120));
    document.addEventListener("change", () => queueRun(120));
  }

  function installRenderObservers() {
    if (observersInstalled) return;
    observersInstalled = true;

    const tryInstall = () => {
      const targets = [
        document.getElementById("resultBody"),
        document.getElementById("topNewsCards"),
        document.getElementById("projectArticles"),
        document.getElementById("projectContent"),
      ].filter(Boolean);

      if (!targets.length) {
        setTimeout(tryInstall, 250);
        return;
      }

      targets.forEach((target) => {
        new MutationObserver(() => queueRun(40)).observe(target, {
          childList: true,
          subtree: true,
        });
      });
    };

    tryInstall();
  }

  function polishMarketInterestColumn() {
    const table = document.querySelector(".market-table");
    const tbody = document.getElementById("resultBody");
    if (!table || !tbody) return;

    const headerRow = table.querySelector("thead tr");
    if (headerRow) {
      [...headerRow.children].forEach((cell) => {
        if (clean(cell.textContent) === "상세") cell.remove();
      });
      const interestHeader = headerRow.querySelector(".interest-header-cell");
      if (interestHeader) {
        interestHeader.textContent = "";
        interestHeader.setAttribute("aria-label", "관심");
      }
    }

    tbody.querySelectorAll("tr:not(.detail-row)").forEach((row) => {
      [...row.children].forEach((cell) => {
        if (cell.querySelector(".detail-button") || clean(cell.getAttribute("data-label")) === "상세") {
          cell.remove();
        }
      });
    });

    tbody.querySelectorAll("tr.detail-row > td").forEach((cell) => {
      if (headerRow) cell.colSpan = headerRow.children.length;
    });
  }

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }
})();
