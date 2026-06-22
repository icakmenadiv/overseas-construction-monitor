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
  let scheduled = false;

  document.addEventListener("DOMContentLoaded", schedule);
  if (document.readyState !== "loading") schedule();

  function schedule() {
    injectLoadMoreStyles();
    [100, 400, 1000, 1800].forEach((delay) => setTimeout(() => apply(false), delay));
    window.addEventListener("resize", debounce(() => apply(false), 180));
    document.addEventListener("change", () => setTimeout(() => apply(true), 260));

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
      .load-more-panel {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        flex-wrap: wrap;
        padding: 18px 0 4px;
      }

      .load-more-status {
        color: #64748b;
        font-size: 0.86rem;
        font-weight: 800;
      }

      .load-more-button {
        min-width: 170px;
        border: 1px solid #bae6fd;
        border-radius: 999px;
        background: linear-gradient(135deg, #ffffff, #ecfeff);
        color: #0f3f68;
        cursor: pointer;
        font-size: 0.92rem;
        font-weight: 900;
        padding: 10px 18px;
        box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
        transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
      }

      .load-more-button:hover,
      .load-more-button:focus-visible {
        border-color: #38bdf8;
        box-shadow: 0 12px 24px rgba(15, 23, 42, 0.12);
        transform: translateY(-1px);
      }

      .load-more-button:disabled {
        cursor: default;
        opacity: 0.72;
        transform: none;
      }

      @media (max-width: 760px) {
        .load-more-panel {
          align-items: stretch;
          flex-direction: column;
          gap: 8px;
          padding-top: 12px;
        }

        .load-more-status {
          text-align: center;
        }

        .load-more-button {
          width: 100%;
          min-height: 44px;
        }
      }
    `;
    document.head.appendChild(style);
  }
})();
