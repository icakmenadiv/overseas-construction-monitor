(() => {
  const PROJECT_LABELS = ["프로젝트명", "지역", "국가", "섹터", "키워드", "발주처", "사업비(USD)", "현재 단계", "최근 업데이트일"];
  const LOAD_MORE_CONFIGS = {
    resultBody: {
      mainSelector: "tr:not(.detail-row)",
      detailSelector: "tr.detail-row",
      desktopInitial: 30,
      desktopStep: 30,
      mobileInitial: 15,
      mobileStep: 15,
      itemLabel: "기사",
    },
    projectBody: {
      mainSelector: "tr",
      detailSelector: "",
      desktopInitial: 30,
      desktopStep: 30,
      mobileInitial: 15,
      mobileStep: 15,
      itemLabel: "프로젝트",
    },
  };

  const visibleLimits = new Map();
  const rowSignatures = new Map();
  let styleInjected = false;
  let uiStyleInjected = false;
  let scheduled = false;

  document.addEventListener("DOMContentLoaded", schedule);
  if (document.readyState !== "loading") schedule();

  function schedule() {
    injectLoadMoreStyles();
    injectUiStabilityStyles();
    [100, 400, 1000, 1800].forEach((delay) => {
      setTimeout(() => apply(false), delay);
      setTimeout(applyFilterUiFixes, delay + 40);
    });
    window.addEventListener("resize", debounce(() => {
      apply(false);
      updateMobileFilterToggle(false);
    }, 180));
    document.addEventListener("change", () => setTimeout(() => apply(true), 260));

    const controlPanel = document.querySelector(".control-panel");
    if (controlPanel && controlPanel.dataset.mobileUiObserver !== "true") {
      controlPanel.dataset.mobileUiObserver = "true";
      new MutationObserver(() => setTimeout(applyFilterUiFixes, 80)).observe(controlPanel, { childList: true, subtree: true });
    }

    Object.keys(LOAD_MORE_CONFIGS).forEach((id) => {
      const target = document.getElementById(id);
      if (!target || target.dataset.loadMoreObserver === "true") return;
      target.dataset.loadMoreObserver = "true";
      new MutationObserver(() => setTimeout(() => apply(null), 80)).observe(target, { childList: true, subtree: true });
    });
  }

  function apply(resetMode) {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      labelProjectRows();
      Object.keys(LOAD_MORE_CONFIGS).forEach((bodyId) => applyLoadMore(bodyId, resetMode));
    });
  }

  function labelProjectRows() {
    document.querySelectorAll("#projectBody tr").forEach((row) => {
      [...row.children].forEach((cell, index) => {
        if (!cell.dataset.label) cell.dataset.label = PROJECT_LABELS[index] || "항목";
      });
    });
  }

  function applyLoadMore(bodyId, resetMode) {
    const config = LOAD_MORE_CONFIGS[bodyId];
    const body = document.getElementById(bodyId);
    if (!body) return;

    const mainRows = [...body.querySelectorAll(config.mainSelector)];
    const total = mainRows.length;
    const signature = getRowSignature(mainRows);
    const previousSignature = rowSignatures.get(bodyId);
    const dataChanged = signature !== previousSignature;

    rowSignatures.set(bodyId, signature);
    if (resetMode === true || !visibleLimits.has(bodyId) || (resetMode === null && dataChanged)) {
      visibleLimits.set(bodyId, getInitialLimit(config));
    }

    const limit = Math.min(visibleLimits.get(bodyId) || getInitialLimit(config), total);
    mainRows.forEach((row, index) => {
      row.classList.remove("mobile-extra");
      row.hidden = index >= limit;
    });

    if (config.detailSelector) {
      [...body.querySelectorAll(config.detailSelector)].forEach((row) => {
        const previousMainRow = findPreviousMainRow(row);
        row.hidden = previousMainRow ? previousMainRow.hidden : false;
      });
    }

    renderLoadMorePanel(body, bodyId, total, limit, config);
  }

  function getRowSignature(rows) {
    return rows
      .map((row, index) => {
        const title = row.querySelector(".title-link, .market-title-cell, .project-title-cell")?.textContent || row.textContent || "";
        return `${index}:${normalizeText(title).slice(0, 80)}`;
      })
      .join("|");
  }

  function renderLoadMorePanel(body, bodyId, total, limit, config) {
    const tableWrap = body.closest(".table-wrap");
    const resultsSection = body.closest(".results-section");
    if (!tableWrap || !resultsSection) return;

    let panel = resultsSection.querySelector(`.load-more-panel[data-target="${bodyId}"]`);
    if (!panel) {
      panel = document.createElement("div");
      panel.className = "load-more-panel";
      panel.dataset.target = bodyId;
      panel.innerHTML = `
        <span class="load-more-status" aria-live="polite"></span>
        <button type="button" class="load-more-button">더 로드하기</button>
      `;
      tableWrap.insertAdjacentElement("afterend", panel);
      panel.querySelector(".load-more-button").addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const current = visibleLimits.get(bodyId) || getInitialLimit(config);
        visibleLimits.set(bodyId, current + getStep(config));
        applyLoadMore(bodyId, false);
      });
    }

    const shown = Math.min(limit, total);
    const status = panel.querySelector(".load-more-status");
    const button = panel.querySelector(".load-more-button");
    panel.hidden = total === 0;
    status.textContent = `${numberFormat(shown)} / ${numberFormat(total)}건 표시 중`;

    if (shown >= total) {
      button.textContent = `전체 ${config.itemLabel} 표시 완료`;
      button.disabled = true;
      button.hidden = total <= getInitialLimit(config);
    } else {
      button.textContent = "더 로드하기";
      button.disabled = false;
      button.hidden = false;
    }
  }

  function applyFilterUiFixes() {
    normalizeSortHelp();
    normalizeFilterQuickActions();
    updateMobileFilterToggle(true);
  }

  function normalizeSortHelp() {
    const sortSelect = document.getElementById("sortSelect");
    if (!sortSelect) return;
    const field = sortSelect.closest(".field");
    const label = field?.querySelector('label[for="sortSelect"]') || document.querySelector('label[for="sortSelect"]');
    if (!field || !label) return;

    let labelRow = field.querySelector(".sort-label-row");
    if (!labelRow) {
      labelRow = document.createElement("div");
      labelRow.className = "sort-label-row";
      label.parentNode.insertBefore(labelRow, label);
      labelRow.appendChild(label);
    } else if (!labelRow.contains(label)) {
      labelRow.prepend(label);
    }

    let help = labelRow.querySelector(".sort-help");
    if (!help) {
      help = document.createElement("button");
      help.className = "sort-help";
      labelRow.appendChild(help);
    }
    if (help.tagName !== "BUTTON") {
      const button = document.createElement("button");
      button.className = help.className;
      button.textContent = "?";
      help.replaceWith(button);
      help = button;
    }

    help.type = "button";
    help.textContent = "?";
    help.setAttribute("aria-label", "정렬 도움말: 관심도순은 하트 관심 수가 높은 항목을 우선 표시합니다. 중요도순은 AI가 국가·섹터별 진출 실적과 우리 기업 관심도 등을 종합해 판단한 값입니다.");
    help.title = "정렬 기준 설명";
    if (help.dataset.bound !== "true") {
      help.dataset.bound = "true";
      help.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        help.classList.toggle("is-active");
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
        details.querySelector("summary")?.insertAdjacentElement("afterend", actions);
      }
      if (!actions) return;

      const currentButton = actions.querySelector('button[data-filter-action="toggle-all"]');
      if (!currentButton || actions.querySelectorAll("button").length !== 1) {
        actions.innerHTML = `<button type="button" data-filter-action="toggle-all">전체 선택/해제</button>`;
      }
      const button = actions.querySelector('button[data-filter-action="toggle-all"]');
      if (button && button.dataset.bound !== "true") {
        button.dataset.bound = "true";
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
          const inputs = [...filter.querySelectorAll('input[type="checkbox"]')];
          const shouldSelect = inputs.some((input) => !input.checked);
          inputs.forEach((input) => {
            input.checked = shouldSelect;
          });
          filter.dispatchEvent(new Event("change", { bubbles: true }));
          updateFilterSummary(details);
        });
      }
      updateFilterSummary(details);
    });
  }

  function updateFilterSummary(details) {
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

  function updateMobileFilterToggle(initialize) {
    const panel = document.querySelector(".control-panel");
    if (!panel) return;
    let body = panel.querySelector(":scope > .mobile-filter-body");
    if (!body) {
      body = document.createElement("div");
      body.className = "mobile-filter-body";
      while (panel.firstChild) body.appendChild(panel.firstChild);
      panel.appendChild(body);
    }
    let button = document.getElementById("mobileFilterToggle");
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.id = "mobileFilterToggle";
      button.className = "mobile-filter-toggle";
      panel.parentNode.insertBefore(button, panel);
    }

    const mobile = isMobile();
    button.hidden = !mobile;
    panel.classList.toggle("has-mobile-filter-toggle", mobile);
    if (!mobile) {
      setMobileFilterOpen(panel, button, body, true);
      return;
    }

    if (!panel.dataset.mobileToggleInitialized && initialize) {
      panel.dataset.mobileToggleInitialized = "true";
      const saved = sessionStorage.getItem(getFilterToggleStorageKey());
      setMobileFilterOpen(panel, button, body, saved === "open");
    } else if (!panel.classList.contains("is-mobile-filter-open")) {
      setMobileFilterOpen(panel, button, body, false);
    }

    if (button.dataset.bound !== "true") {
      button.dataset.bound = "true";
      button.addEventListener("click", () => {
        const nextOpen = !panel.classList.contains("is-mobile-filter-open");
        setMobileFilterOpen(panel, button, body, nextOpen);
        sessionStorage.setItem(getFilterToggleStorageKey(), nextOpen ? "open" : "closed");
      });
    }
  }

  function setMobileFilterOpen(panel, button, body, open) {
    panel.classList.toggle("is-mobile-filter-open", open);
    button.setAttribute("aria-expanded", String(open));
    button.innerHTML = open ? `<span>필터 접기</span><strong>검색·조건 숨기기</strong>` : `<span>필터 열기</span><strong>검색·조건 보기</strong>`;
    body.hidden = !open && isMobile();
  }

  function getFilterToggleStorageKey() {
    return document.getElementById("projectBody") ? "projectMobileFilterOpen" : "marketMobileFilterOpen";
  }

  function findPreviousMainRow(row) {
    let previous = row.previousElementSibling;
    while (previous && previous.classList.contains("detail-row")) {
      previous = previous.previousElementSibling;
    }
    return previous;
  }

  function getInitialLimit(config) {
    return isMobile() ? config.mobileInitial : config.desktopInitial;
  }

  function getStep(config) {
    return isMobile() ? config.mobileStep : config.desktopStep;
  }

  function isMobile() {
    return window.matchMedia("(max-width: 760px)").matches;
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function numberFormat(value) {
    return new Intl.NumberFormat("ko-KR").format(value);
  }

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function injectLoadMoreStyles() {
    if (styleInjected || document.getElementById("loadMoreInlineStyles")) return;
    styleInjected = true;
    const style = document.createElement("style");
    style.id = "loadMoreInlineStyles";
    style.textContent = `
      .load-more-panel { display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap; padding: 18px 0 4px; }
      .load-more-status { color: #64748b; font-size: 0.86rem; font-weight: 800; }
      .load-more-button { min-width: 170px; border: 1px solid #bae6fd; border-radius: 999px; background: linear-gradient(135deg, #ffffff, #ecfeff); color: #0f3f68; cursor: pointer; font-size: 0.92rem; font-weight: 900; padding: 10px 18px; box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08); transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease; }
      .load-more-button:hover, .load-more-button:focus-visible { border-color: #38bdf8; box-shadow: 0 12px 24px rgba(15, 23, 42, 0.12); transform: translateY(-1px); }
      .load-more-button:disabled { cursor: default; opacity: 0.72; transform: none; }
      @media (max-width: 760px) { .load-more-panel { align-items: stretch; flex-direction: column; gap: 8px; padding-top: 12px; } .load-more-status { text-align: center; } .load-more-button { width: 100%; min-height: 44px; } }
    `;
    document.head.appendChild(style);
  }

  function injectUiStabilityStyles() {
    if (uiStyleInjected || document.getElementById("mobileFilterUiStabilityStyles")) return;
    uiStyleInjected = true;
    const style = document.createElement("style");
    style.id = "mobileFilterUiStabilityStyles";
    style.textContent = `
      .filter-mini-actions { display: flex !important; justify-content: flex-end !important; gap: 6px !important; padding: 8px 10px 0 !important; }
      .filter-mini-actions button[data-filter-action="toggle-all"] { border: 0; color: var(--slate-500, #64748b); background: transparent; font-size: 0.72rem; font-weight: 850; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
      .filter-mini-actions button[data-filter-action="toggle-all"]:hover, .filter-mini-actions button[data-filter-action="toggle-all"]:focus-visible { color: var(--blue-700, #1769c2); }
      .sort-label-row { display: flex !important; align-items: center !important; gap: 7px !important; margin-bottom: 8px !important; }
      .sort-label-row label { margin-bottom: 0 !important; }
      button.sort-help, .sort-help { position: relative !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; flex: 0 0 auto !important; width: 22px !important; height: 22px !important; padding: 0 !important; border: 0 !important; border-radius: 999px !important; color: var(--blue-700, #1769c2) !important; background: rgba(18, 83, 164, 0.12) !important; appearance: none !important; -webkit-appearance: none !important; font-size: 0.78rem !important; font-weight: 950 !important; line-height: 1 !important; cursor: help !important; user-select: none !important; z-index: 120 !important; }
      .sort-help::after { position: absolute; left: 50%; bottom: calc(100% + 10px); z-index: 9999; width: min(340px, 72vw); padding: 10px 12px; color: #fff; background: rgba(15, 23, 42, 0.94); border-radius: 12px; box-shadow: 0 16px 36px rgba(6, 21, 43, 0.20); content: attr(aria-label); font-size: 0.76rem; font-weight: 700; line-height: 1.5; opacity: 0; pointer-events: none; white-space: normal; transform: translate(-50%, 6px); transition: opacity 160ms ease, transform 160ms ease; }
      .sort-help:hover::after, .sort-help:focus::after, .sort-help.is-active::after { opacity: 1 !important; transform: translate(-50%, 0) !important; }
      .mobile-filter-toggle { display: none; }
      @media (max-width: 760px) {
        .sort-help::after { left: auto !important; right: 0 !important; width: min(320px, calc(100vw - 40px)) !important; transform: translate(0, 6px) !important; }
        .sort-help:hover::after, .sort-help:focus::after, .sort-help.is-active::after { transform: translate(0, 0) !important; }
        .mobile-filter-toggle { display: flex; align-items: center; justify-content: space-between; gap: 10px; width: calc(100% - 16px); margin: 8px 8px 10px; padding: 12px 14px; border: 1px solid rgba(18, 83, 164, 0.18); border-radius: 16px; color: #10243d; background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(236, 254, 255, 0.95)); box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08); font: inherit; cursor: pointer; }
        .mobile-filter-toggle span { font-size: 0.96rem; font-weight: 950; }
        .mobile-filter-toggle strong { color: #1769c2; font-size: 0.75rem; font-weight: 900; }
        .mobile-filter-toggle::after { flex: 0 0 auto; width: 24px; height: 24px; border-radius: 999px; color: #fff; background: linear-gradient(135deg, #1769c2, #16a6c9); content: "+"; display: inline-flex; align-items: center; justify-content: center; font-size: 1rem; font-weight: 950; }
        .mobile-filter-toggle[aria-expanded="true"]::after { content: "−"; }
        .control-panel.has-mobile-filter-toggle:not(.is-mobile-filter-open) { display: block !important; padding: 0 !important; border: 0 !important; background: transparent !important; box-shadow: none !important; }
        .control-panel.has-mobile-filter-toggle:not(.is-mobile-filter-open) .mobile-filter-body { display: none !important; }
      }
    `;
    document.head.appendChild(style);
  }
})();
