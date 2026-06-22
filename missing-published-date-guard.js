(() => {
  document.addEventListener("DOMContentLoaded", init);
  if (document.readyState !== "loading") init();

  function init() {
    injectStyles();
    markMissingDates();
    const body = document.getElementById("resultBody");
    if (body && body.dataset.missingDateGuard !== "true") {
      body.dataset.missingDateGuard = "true";
      new MutationObserver(() => window.requestAnimationFrame(markMissingDates)).observe(body, { childList: true, subtree: true });
    }
  }

  function markMissingDates() {
    document.querySelectorAll("#resultBody .date-cell").forEach((cell) => {
      const text = cell.textContent.trim();
      if (text) return;
      cell.textContent = "미확인";
      cell.classList.add("missing-published-date");
      cell.title = "운영시트의 원문게재일 값이 비어 있습니다. 기사수집일 또는 원문 출처 기준으로 보완이 필요합니다.";
    });
  }

  function injectStyles() {
    if (document.getElementById("missingPublishedDateGuardStyles")) return;
    const style = document.createElement("style");
    style.id = "missingPublishedDateGuardStyles";
    style.textContent = `
      .date-cell.missing-published-date {
        color: #b45309;
        font-weight: 900;
      }

      .date-cell.missing-published-date::before {
        content: "! ";
      }
    `;
    document.head.appendChild(style);
  }
})();
