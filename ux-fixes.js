(function () {
  const MARKET_EXPORT_COLUMNS = [
    "원문게재일",
    "기사수집일",
    "지역",
    "국가",
    "섹터",
    "주제",
    "정보 분류",
    "프로젝트명",
    "관련 단계",
    "제목(한글)",
    "제목(원문)",
    "내용",
    "중요도",
    "출처언어",
    "출처링크",
  ];
  const SHEET_URL_PATTERN = "docs.google.com/spreadsheets/d/";
  const SHEET_TIMEOUT_MS = 9000;

  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback);
      return;
    }
    callback();
  }

  function installSheetFetchFallback() {
    if (!window.fetch || window.__sheetFetchFallbackInstalled) return;
    window.__sheetFetchFallbackInstalled = true;
    const originalFetch = window.fetch.bind(window);

    window.fetch = async function resilientFetch(input, init) {
      const url = typeof input === "string" ? input : input && input.url;
      if (!url || !url.includes(SHEET_URL_PATTERN) || !url.includes("/gviz/tq")) {
        return originalFetch(input, init);
      }

      try {
        return await withTimeout(originalFetch(input, init), SHEET_TIMEOUT_MS);
      } catch (error) {
        console.warn("Google Sheets fetch fallback activated:", error);
        const data = await fetchGvizJsonp(url);
        return {
          ok: true,
          status: 200,
          text: async () => `google.visualization.Query.setResponse(${JSON.stringify(data)})`,
        };
      }
    };
  }

  function withTimeout(promise, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Google Sheets request timed out")), timeoutMs);
      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }

  function fetchGvizJsonp(url) {
    return new Promise((resolve, reject) => {
      const callbackName = `__gvizFallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement("script");
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Google Sheets JSONP fallback timed out"));
      }, SHEET_TIMEOUT_MS);

      window[callbackName] = (data) => {
        clearTimeout(timeout);
        cleanup();
        resolve(data);
      };

      script.onerror = () => {
        clearTimeout(timeout);
        cleanup();
        reject(new Error("Google Sheets JSONP fallback failed"));
      };

      const fallbackUrl = new URL(url);
      const tqx = fallbackUrl.searchParams.get("tqx") || "out:json";
      const parts = tqx
        .split(";")
        .map((part) => part.trim())
        .filter(Boolean)
        .filter((part) => !part.startsWith("responseHandler:"));
      if (!parts.some((part) => part === "out:json")) parts.unshift("out:json");
      parts.push(`responseHandler:${callbackName}`);
      fallbackUrl.searchParams.set("tqx", parts.join(";"));
      fallbackUrl.searchParams.set("_", String(Date.now()));

      script.src = fallbackUrl.toString();
      document.head.appendChild(script);

      function cleanup() {
        delete window[callbackName];
        script.remove();
      }
    });
  }

  function retryIfSheetStillLoading() {
    setTimeout(() => {
      const loading = document.getElementById("loadingState");
      const total = document.getElementById("totalCount");
      const isStillLoading = loading && !loading.hidden && (!total || total.textContent.trim() === "0");
      if (!isStillLoading) return;

      if (typeof refreshData === "function") {
        refreshData();
        return;
      }
      if (typeof loadProjects === "function") {
        loadProjects();
      }
    }, SHEET_TIMEOUT_MS + 1200);
  }

  function relabelControls() {
    document.querySelectorAll("#resetButton").forEach((button) => {
      button.textContent = "필터 초기화";
    });

    const exportButton = document.getElementById("exportButton");
    if (exportButton) {
      exportButton.textContent = "목록 다운로드";
      exportButton.title = "현재 목록을 CSV로 다운로드";
    }

    document.querySelectorAll("#backToTopButton").forEach((button) => {
      button.textContent = "상단으로 가기";
    });
  }

  function patchSingleMarketDetail() {
    if (typeof state === "undefined" || typeof renderRows !== "function") return;
    if (!state.expanded || typeof state.expanded.clear !== "function") return;

    toggleDetail = function (id) {
      const shouldClose = state.expanded.has(id);
      state.expanded.clear();
      if (!shouldClose) state.expanded.add(id);
      renderRows();
    };
  }

  function patchMarketDownload() {
    const exportButton = document.getElementById("exportButton");
    if (!exportButton || typeof state === "undefined") return;

    exportButton.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        downloadMarketCsv(exportButton);
      },
      true,
    );
  }

  function downloadMarketCsv(button) {
    const rows = state.filteredRows || [];
    if (!rows.length) {
      alert("다운로드할 데이터가 없습니다.");
      return;
    }

    const previousText = button.textContent;
    button.disabled = true;
    button.textContent = "다운로드 중";

    try {
      const csvRows = [
        MARKET_EXPORT_COLUMNS.map(quoteCsv).join(","),
        ...rows.map((row) => MARKET_EXPORT_COLUMNS.map((column) => quoteCsv(row[column] || "")).join(",")),
      ];
      const csvContent = `\ufeff${csvRows.join("\r\n")}`;
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `market-monitoring-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error("CSV download failed:", error);
      alert("목록 다운로드 중 오류가 발생했습니다.");
    } finally {
      button.disabled = false;
      button.textContent = previousText || "목록 다운로드";
    }
  }

  function quoteCsv(value) {
    return `"${String(value).replace(/"/g, '""')}"`;
  }

  function injectPolishStyles() {
    if (document.getElementById("ux-fixes-style")) return;
    const style = document.createElement("style");
    style.id = "ux-fixes-style";
    style.textContent = `
      #resetButton,
      #exportButton,
      .panel-actions button {
        white-space: nowrap;
      }

      #exportButton,
      #resetButton {
        min-width: 0;
        padding-inline: 8px;
        font-size: 0.78rem;
        line-height: 1.15;
      }

      .back-to-top {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 1000;
        min-height: 42px;
        padding: 0 14px;
        border: 1px solid rgba(19, 92, 155, 0.24);
        border-radius: 999px;
        background: #ffffff;
        box-shadow: 0 12px 28px rgba(16, 36, 61, 0.18);
        color: #0a2342;
        font-size: 0.82rem;
        font-weight: 900;
      }

      .back-to-top:hover,
      .back-to-top:focus-visible {
        background: #eef7fc;
      }

      body {
        padding-bottom: 72px;
      }

      @media (max-width: 760px) {
        body {
          padding-bottom: 84px;
          overflow-x: hidden;
        }

        .site-header {
          padding: 20px 12px 26px;
        }

        .brand-wrap {
          width: 100%;
          align-items: flex-start;
          gap: 12px;
        }

        .brand {
          width: 112px;
          height: 48px;
          flex: 0 0 auto;
        }

        .brand-logo {
          max-width: 92px;
          max-height: 30px;
        }

        .brand-wrap h1 {
          font-size: clamp(1.65rem, 8vw, 2.2rem);
          line-height: 1.12;
        }

        .subtitle {
          font-size: 0.9rem;
          line-height: 1.35;
        }

        .header-actions {
          width: 100%;
          gap: 10px;
        }

        .page-nav {
          width: 100%;
          gap: 8px;
          padding: 6px;
        }

        .page-nav a {
          min-height: 44px;
          padding-inline: 8px;
          font-size: 0.86rem;
          white-space: nowrap;
        }

        .market-dashboard,
        body:has(#projectBody) .dashboard,
        .dashboard {
          display: block;
          width: 100%;
          padding: 16px 10px 94px;
        }

        .market-filter-panel,
        body:has(#projectBody) .control-panel,
        .control-panel {
          position: relative;
          top: auto;
          max-height: none;
          overflow: visible;
          margin: 0 0 12px;
          padding: 14px;
          transform: none;
        }

        .search-field input,
        .market-dashboard .search-field input,
        body:has(#projectBody) .search-field input {
          min-height: 46px;
          font-size: 0.92rem;
        }

        .market-dashboard .action-buttons,
        body:has(#projectBody) .action-buttons,
        .action-buttons {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        #exportButton,
        #resetButton,
        .panel-actions button {
          min-height: 38px;
          padding-inline: 6px;
          font-size: 0.72rem;
        }

        .summary-grid,
        .market-dashboard .summary-grid,
        body:has(#projectBody) .summary-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .summary-item,
        .market-dashboard .summary-item,
        body:has(#projectBody) .summary-item {
          min-height: 70px;
          padding: 10px;
        }

        .summary-item strong,
        .market-dashboard .summary-item strong,
        body:has(#projectBody) .summary-item strong {
          font-size: 1.25rem;
        }

        .section-head,
        .market-dashboard .section-head,
        body:has(#projectBody) .section-head {
          align-items: flex-start;
          flex-direction: column;
          gap: 8px;
          padding: 12px;
        }

        .section-head h2,
        .market-dashboard .section-head h2,
        body:has(#projectBody) .section-head h2 {
          font-size: 1rem;
        }

        .section-head p,
        .market-dashboard .section-head p,
        body:has(#projectBody) .section-head p {
          font-size: 0.76rem;
        }

        .table-wrap,
        body:has(#projectBody) .table-wrap {
          max-width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        .market-table {
          min-width: 760px;
        }

        .project-list-table {
          min-width: 920px;
        }

        .detail-panel {
          grid-template-columns: 1fr !important;
          gap: 12px;
          padding: 14px;
        }

        .detail-meta {
          min-width: 0;
        }

        .footer-brand {
          padding-right: 120px;
        }

        .back-to-top {
          right: 12px;
          bottom: 12px;
          min-height: 38px;
          padding: 0 11px;
          font-size: 0.72rem;
        }
      }
    `;
    document.head.appendChild(style);
  }

  onReady(() => {
    installSheetFetchFallback();
    relabelControls();
    patchSingleMarketDetail();
    patchMarketDownload();
    injectPolishStyles();
    retryIfSheetStillLoading();
  });
})();
