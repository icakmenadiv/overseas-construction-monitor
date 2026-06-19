(() => {
  const MAX_MOBILE_ROWS = 20;
  const PROJECT_LABELS = ["프로젝트명", "지역", "국가", "섹터", "키워드", "발주처", "사업비(USD)", "현재 단계", "최근 업데이트일"];

  document.addEventListener("DOMContentLoaded", schedule);
  if (document.readyState !== "loading") schedule();

  function schedule() {
    [100, 400, 1000, 1800].forEach((delay) => setTimeout(apply, delay));
    window.addEventListener("resize", () => setTimeout(apply, 120));
    document.addEventListener("click", () => setTimeout(apply, 160));
    document.addEventListener("change", () => setTimeout(apply, 260));
    ["resultBody", "projectBody"].forEach((id) => {
      const target = document.getElementById(id);
      if (!target) return;
      new MutationObserver(() => setTimeout(apply, 80)).observe(target, { childList: true, subtree: true });
    });
  }

  function apply() {
    labelProjectRows();
    limitRows("#resultBody tr:not(.detail-row)");
    limitRows("#projectBody tr");
  }

  function labelProjectRows() {
    document.querySelectorAll("#projectBody tr").forEach((row) => {
      [...row.children].forEach((cell, index) => {
        if (!cell.dataset.label) cell.dataset.label = PROJECT_LABELS[index] || "항목";
      });
    });
  }

  function limitRows(selector) {
    const rows = [...document.querySelectorAll(selector)];
    rows.forEach((row, index) => {
      row.classList.toggle("mobile-extra", index >= MAX_MOBILE_ROWS);
    });
  }
})();
