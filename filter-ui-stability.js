(() => {
  const DEFAULTS = {
    marketSort: "중요도:desc",
    projectSort: "cost:desc",
  };

  document.addEventListener("DOMContentLoaded", init);
  if (document.readyState !== "loading") init();

  function init() {
    applyAllFixes();
    [200, 700, 1500, 2600].forEach((delay) => setTimeout(applyAllFixes, delay));
    new MutationObserver(debounce(applyAllFixes, 120)).observe(document.body, { childList: true, subtree: true });
  }

  function applyAllFixes() {
    injectStyles();
    normalizeSortHelp();
    normalizeFilterQuickActions();
    syncFilterSummaries();
    normalizeDefaultLabels();
  }

  function normalizeSortHelp() {
    const sortSelect = document.getElementById("sortSelect");
    if (!sortSelect) return;

    let labelRow = sortSelect.closest(".field")?.querySelector(".sort-label-row");
    const label = document.querySelector('label[for="sortSelect"]');

    if (!labelRow && label) {
      labelRow = document.createElement("div");
      labelRow.className = "sort-label-row";
      label.parentNode.insertBefore(labelRow, label);
      labelRow.appendChild(label);
    }

    let help = document.querySelector(".sort-help");
    if (!help && labelRow) {
      help = document.createElement("button");
      help.className = "sort-help";
      help.textContent = "?";
      labelRow.appendChild(help);
    }

    if (!help) return;
    if (help.tagName !== "BUTTON") {
      const button = document.createElement("button");
      button.className = help.className;
      button.textContent = help.textContent.trim() || "?";
      [...help.attributes].forEach((attr) => {
        if (attr.name !== "class") button.setAttribute(attr.name, attr.value);
      });
      help.replaceWith(button);
      help = button;
    }

    help.type = "button";
    help.textContent = "?";
    help.tabIndex = 0;
    help.setAttribute(
      "aria-label",
      "정렬 도움말: 관심도순은 하트 관심 수가 높은 항목을 우선 표시합니다. 중요도순은 국가·섹터별 진출 실적과 우리 기업 관심도 등을 종합한 AI 판단값입니다.",
    );
    help.title = "관심도순은 하트 관심 수 기준, 중요도순은 AI 판단값 기준입니다.";
    if (help.dataset.stabilityBound !== "true") {
      help.dataset.stabilityBound = "true";
      help.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        help.classList.toggle("is-active");
        help.focus();
      });
      document.addEventListener("click", (event) => {
        if (!event.target.closest(".sort-help")) help.classList.remove("is-active");
      });
    }
  }

  function normalizeFilterQuickActions() {
    document.querySelectorAll(".filter-collapse").forEach((details) => {
      const filter = details.querySelector(".checkbox-filter");
      if (!filter) return;

      let actions = details.querySelector(":scope > .filter-mini-actions");
      if (!actions) {
        actions = document.createElement("div");
        actions.className = "filter-mini-actions";
        const summary = details.querySelector("summary");
        if (summary) summary.insertAdjacentElement("afterend", actions);
        else details.prepend(actions);
      }

      if (actions.dataset.unifiedToggle === "true") return;
      actions.dataset.unifiedToggle = "true";
      actions.innerHTML = `<button type="button" data-filter-action="toggle-all">전체 선택/해제</button>`;
      actions.addEventListener("click", (event) => {
        const button = event.target.closest('button[data-filter-action="toggle-all"]');
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();

        const inputs = [...filter.querySelectorAll('input[type="checkbox"]')];
        const shouldSelect = inputs.some((input) => !input.checked);
        inputs.forEach((input) => {
          input.checked = shouldSelect;
        });
        filter.dispatchEvent(new Event("change", { bubbles: true }));
        updateOneFilterSummary(details);
      });
    });
  }

  function syncFilterSummaries() {
    document.querySelectorAll(".filter-collapse").forEach(updateOneFilterSummary);
  }

  function updateOneFilterSummary(details) {
    const summary = details.querySelector(".filter-summary");
    if (!summary) return;

    const inputs = [...details.querySelectorAll('.checkbox-filter input[type="checkbox"]')];
    const checked = inputs.filter((input) => input.checked);
    if (!checked.length) {
      summary.textContent = "전체";
      summary.classList.remove("has-active-filter");
      details.classList.remove("has-active-filter");
      return;
    }

    if (checked.length === inputs.length && inputs.length > 0) {
      summary.textContent = "전체 선택";
    } else {
      const first = checked[0].closest("label")?.textContent.trim() || checked[0].value;
      summary.textContent = checked.length === 1 ? first : `${first} 외 ${checked.length - 1}`;
    }
    summary.classList.add("has-active-filter");
    details.classList.add("has-active-filter");
  }

  function normalizeDefaultLabels() {
    const isProject = Boolean(document.getElementById("projectBody"));
    if (isProject) {
      document.querySelectorAll(".cost-toggle span").forEach((span) => {
        span.textContent = span.textContent.replace("1천만불", "1백만불");
      });
      const activeFilterText = document.getElementById("activeFilterText");
      if (activeFilterText) activeFilterText.textContent = activeFilterText.textContent.replace("1천만불", "1백만불");
    }
  }

  function injectStyles() {
    if (document.getElementById("filterUiStabilityStyles")) return;
    const style = document.createElement("style");
    style.id = "filterUiStabilityStyles";
    style.textContent = `
      .filter-mini-actions {
        justify-content: flex-end !important;
      }

      .filter-mini-actions button[data-filter-action="toggle-all"] {
        border: 0;
        color: var(--slate-500, #64748b);
        background: transparent;
        font-size: 0.72rem;
        font-weight: 850;
        text-decoration: underline;
        text-underline-offset: 3px;
        cursor: pointer;
      }

      .filter-mini-actions button[data-filter-action="toggle-all"]:hover,
      .filter-mini-actions button[data-filter-action="toggle-all"]:focus-visible {
        color: var(--blue-700, #1769c2);
      }

      button.sort-help,
      .sort-help {
        border: 0;
        appearance: none;
        -webkit-appearance: none;
        user-select: none;
      }

      button.sort-help {
        padding: 0;
      }

      .sort-help.is-active::after,
      .sort-help.is-active::before {
        opacity: 1 !important;
        transform: translate(-50%, 0) !important;
      }

      @media (max-width: 760px) {
        .sort-help.is-active::after,
        .sort-help.is-active::before {
          transform: translate(0, 0) !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }
})();
