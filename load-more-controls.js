(() => {
  const CONFIGS = {
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

  const state = new Map();
  let scheduled = false;

  document.addEventListener("DOMContentLoaded", init);
  if (document.readyState !== "loading") init();

  function init() {
    Object.keys(CONFIGS).forEach((bodyId) => {
      const body = document.getElementById(bodyId);
      if (!body || body.dataset.loadMoreReady === "true") return;
      body.dataset.loadMoreReady = "true";
      state.set(bodyId, getInitialLimit(CONFIGS[bodyId]));
      new MutationObserver(() => scheduleApply(bodyId, true)).observe(body, { childList: true, subtree: true });
      scheduleApply(bodyId, true);
    });

    window.addEventListener("resize", debounce(() => {
      Object.keys(CONFIGS).forEach((bodyId) => scheduleApply(bodyId, false));
    }, 180));
  }

  function scheduleApply(bodyId, resetVisible) {
    if (resetVisible) state.set(bodyId, getInitialLimit(CONFIGS[bodyId]));
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      Object.keys(CONFIGS).forEach(applyLoadMore);
    });
  }

  function applyLoadMore(bodyId) {
    const config = CONFIGS[bodyId];
    const body = document.getElementById(bodyId);
    if (!body) return;

    const mainRows = [...body.querySelectorAll(config.mainSelector)];
    const total = mainRows.length;
    const visibleLimit = Math.min(state.get(bodyId) || getInitialLimit(config), total);

    mainRows.forEach((row, index) => {
      row.classList.remove("mobile-extra");
      row.hidden = index >= visibleLimit;
    });

    if (config.detailSelector) {
      [...body.querySelectorAll(config.detailSelector)].forEach((row) => {
        const previousMainRow = findPreviousMainRow(row);
        row.hidden = previousMainRow ? previousMainRow.hidden : false;
      });
    }

    renderControl(body, bodyId, total, visibleLimit, config);
  }

  function renderControl(body, bodyId, total, visibleLimit, config) {
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
      panel.querySelector(".load-more-button").addEventListener("click", () => {
        const current = state.get(bodyId) || getInitialLimit(config);
        state.set(bodyId, current + getStep(config));
        applyLoadMore(bodyId);
      });
    }

    const status = panel.querySelector(".load-more-status");
    const button = panel.querySelector(".load-more-button");
    const shown = Math.min(visibleLimit, total);

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
})();
