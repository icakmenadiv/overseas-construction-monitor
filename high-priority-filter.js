(() => {
  const BUTTON_ID = "highPriorityButton";
  const STORAGE_KEY = "marketHighPriorityOnly";
  const ACTIVE_CLASS = "is-active";

  let highPriorityOnly = false;
  let baseApplyFilters = null;

  function initHighPriorityFilter() {
    const button = document.getElementById(BUTTON_ID);
    if (!button || typeof window.applyFilters !== "function") return;

    baseApplyFilters = window.applyFilters;
    highPriorityOnly = localStorage.getItem(STORAGE_KEY) === "true";
    syncButtonState(button);

    window.applyFilters = function patchedApplyFilters(...args) {
      baseApplyFilters.apply(this, args);
      applyHighPriorityOnly();
    };

    button.addEventListener("click", () => {
      highPriorityOnly = !highPriorityOnly;
      localStorage.setItem(STORAGE_KEY, String(highPriorityOnly));
      syncButtonState(button);
      window.applyFilters();
    });

    applyHighPriorityOnly();
  }

  function applyHighPriorityOnly() {
    const state = window.state;
    const config = window.CONFIG || { DISPLAY_LIMIT: 200 };
    const els = window.els || {};
    if (!state || !Array.isArray(state.filteredRows)) return;

    if (highPriorityOnly) {
      state.filteredRows = state.filteredRows.filter(isHighPriorityRow);
    }

    if (state.expanded && typeof state.expanded.forEach === "function") {
      state.expanded.forEach((id) => {
        if (!state.filteredRows.some((row) => row.id === id)) state.expanded.delete(id);
      });
    }

    if (typeof window.updateSummary === "function") window.updateSummary();
    if (typeof window.renderRows === "function") window.renderRows();
    updatePriorityFilterText(els, config);
  }

  function isHighPriorityRow(row) {
    const rawImportance = cleanText(row["중요도"]);
    const rawCheck = cleanText(row["담당자 활용시 체크"]);
    const text = `${rawImportance} ${rawCheck}`.toLowerCase();

    if (!text.trim()) return false;
    if (/낮|낮음|low|보통|중간|medium|제외|false|no|n\/a/.test(text)) return false;
    return /높|높음|high|상|중요|priority|우선|대규모|초기|검토|활용|yes|true|y/.test(text);
  }

  function cleanText(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function syncButtonState(button) {
    button.classList.toggle(ACTIVE_CLASS, highPriorityOnly);
    button.setAttribute("aria-pressed", String(highPriorityOnly));
  }

  function updatePriorityFilterText(els, config) {
    if (!els.activeFilterText || !highPriorityOnly) return;

    const currentText = els.activeFilterText.textContent || "";
    const tag = "높은 중요도만";
    if (!currentText.includes(tag)) {
      els.activeFilterText.textContent = currentText ? `${currentText} · ${tag}` : tag;
    }

    if (els.resultCountLabel && window.state?.filteredRows) {
      const shownCount = Math.min(window.state.filteredRows.length, config.DISPLAY_LIMIT || 200);
      els.resultCountLabel.textContent =
        window.state.filteredRows.length > (config.DISPLAY_LIMIT || 200)
          ? `${numberFormatSafe(shownCount)}건 표시 / 전체 ${numberFormatSafe(window.state.filteredRows.length)}건`
          : `${numberFormatSafe(window.state.filteredRows.length)}건`;
    }
  }

  function numberFormatSafe(value) {
    return typeof window.numberFormat === "function" ? window.numberFormat(value) : new Intl.NumberFormat("ko-KR").format(value);
  }

  document.addEventListener("DOMContentLoaded", () => {
    window.setTimeout(initHighPriorityFilter, 0);
  });
})();
