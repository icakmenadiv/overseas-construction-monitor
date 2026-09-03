(() => {
  const BUTTON_ID = "highPriorityButton";
  const STORAGE_KEY = "marketHighPriorityOnly";
  const ACTIVE_CLASS = "is-active";

  let highPriorityOnly = false;
  let baseCreateMainRow = null;
  let baseRenderRows = null;

  function initHighPriorityFilter() {
    const button = document.getElementById(BUTTON_ID);
    if (!button) return;

    highPriorityOnly = localStorage.getItem(STORAGE_KEY) === "true";
    syncButtonState(button);
    patchMarketRendering();

    button.addEventListener("click", () => {
      highPriorityOnly = !highPriorityOnly;
      localStorage.setItem(STORAGE_KEY, String(highPriorityOnly));
      syncButtonState(button);
      rerenderRows();
    });

    applyHighPriorityView();
  }

  function patchMarketRendering() {
    if (typeof window.createMainRow === "function" && !baseCreateMainRow) {
      baseCreateMainRow = window.createMainRow;
      window.createMainRow = function patchedCreateMainRow(row, isExpanded) {
        const tr = baseCreateMainRow.call(this, row, isExpanded);
        tr.dataset.highPriority = String(isHighPriorityRow(row));
        tr.dataset.marketRowId = row.id || "";
        return tr;
      };
    }

    if (typeof window.renderRows === "function" && !baseRenderRows) {
      baseRenderRows = window.renderRows;
      window.renderRows = function patchedRenderRows(...args) {
        baseRenderRows.apply(this, args);
        applyHighPriorityView();
      };
    }
  }

  function rerenderRows() {
    if (typeof window.renderRows === "function") {
      window.renderRows();
    } else {
      applyHighPriorityView();
    }
  }

  function applyHighPriorityView() {
    const resultBody = document.getElementById("resultBody");
    if (!resultBody) return;

    const rows = [...resultBody.querySelectorAll("tr")];
    let visibleMainRows = 0;
    let previousMainVisible = false;

    rows.forEach((row) => {
      if (row.classList.contains("detail-row")) {
        row.hidden = highPriorityOnly && !previousMainVisible;
        return;
      }

      const shouldShow = !highPriorityOnly || row.dataset.highPriority === "true";
      row.hidden = !shouldShow;
      previousMainVisible = shouldShow;
      if (shouldShow) visibleMainRows += 1;
    });

    updatePriorityFilterText(visibleMainRows);
  }

  function isHighPriorityRow(row) {
    const rawImportance = cleanText(row?.["중요도"]);
    const rawCheck = cleanText(row?.["담당자 활용시 체크"]);
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

  function updatePriorityFilterText(visibleMainRows) {
    const activeFilterText = document.getElementById("activeFilterText");
    const resultCountLabel = document.getElementById("resultCountLabel");
    const emptyState = document.getElementById("emptyState");
    const tableWrap = document.getElementById("tableWrap");
    const loadingState = document.getElementById("loadingState");

    if (!highPriorityOnly) return;

    if (activeFilterText) {
      const currentText = activeFilterText.textContent || "";
      const tag = "높은 중요도만";
      if (!currentText.includes(tag)) {
        activeFilterText.textContent = currentText ? `${currentText} · ${tag}` : tag;
      }
    }

    if (resultCountLabel) {
      resultCountLabel.textContent = `${new Intl.NumberFormat("ko-KR").format(visibleMainRows)}건`;
    }

    if (loadingState && loadingState.hidden && emptyState && tableWrap) {
      emptyState.hidden = visibleMainRows > 0;
      tableWrap.hidden = visibleMainRows === 0;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    window.setTimeout(initHighPriorityFilter, 0);
  });
})();
