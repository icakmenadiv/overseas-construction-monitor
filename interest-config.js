// Anonymous interest-heart feature configuration.
//
// Safety rule:
// - Keep INTEREST_FEATURE_ENABLED false on production unless the UI has been tested.
// - You can preview the feature without changing this file by opening index.html?interest=1.
//
// Backend rule:
// - Leave INTEREST_API_ENDPOINT empty for browser-only test mode.
// - After deploying the Cloudflare Worker, set it to the Worker URL.

window.INTEREST_FEATURE_ENABLED = false;
window.INTEREST_API_ENDPOINT = "";

(() => {
  const params = new URLSearchParams(window.location.search);
  const previewEnabled = params.get("interest") === "1";
  const shouldPolish = Boolean(window.INTEREST_FEATURE_ENABLED) || previewEnabled;
  if (!shouldPolish) return;

  const run = () => {
    window.InterestFeature?.enhanceAll?.();
    polishMarketInterestColumn();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", schedule);
  } else {
    schedule();
  }

  function schedule() {
    [160, 500, 1100, 1900].forEach((delay) => setTimeout(run, delay));
    document.addEventListener("click", () => {
      setTimeout(run, 260);
      setTimeout(run, 760);
    });
    document.addEventListener("input", () => setTimeout(run, 500));
    document.addEventListener("change", () => setTimeout(run, 500));
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
