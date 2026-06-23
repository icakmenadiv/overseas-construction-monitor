(() => {
  const COUNTRY_FILTER_ID = "countryFilter";
  const GROUPED_CLASS = "is-country-grouped";
  const groupingTimers = new WeakMap();
  const finalCopyTimers = [0, 60, 180, 500, 1200, 2500];

  patchMarketDateHandling();
  patchTopNewsCards();
  injectPolishStyles();
  bootWhenReady();

  function bootWhenReady() {
    runDomPatches();
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", runDomPatches);
    window.addEventListener("load", runDomPatches);
    finalCopyTimers.forEach((delay) => setTimeout(runDomPatches, delay));
    installFastInterestRefresh();
  }

  function runDomPatches() {
    applyFinalCopy();
    buildCollapsibleFilters();
    bindGlobalResetButtons();
    bindResetFix();
    moveProjectFilterControls();
    scheduleAllFilterSummaries();
  }

  function applyFinalCopy() {
    const isProjectPage = Boolean(document.getElementById("projectBody"));
    const eyebrow = document.querySelector(".brand-wrap .eyebrow");
    const title = document.querySelector(".brand-wrap h1");
    const subtitle = document.querySelector(".brand-wrap .subtitle");
    const navLinks = document.querySelectorAll(".page-nav a");

    if (navLinks[0]) navLinks[0].textContent = "해외 건설시장 뉴스";
    if (navLinks[1]) navLinks[1].textContent = "프로젝트 목록";

    if (isProjectPage) {
      if (eyebrow) eyebrow.textContent = "Project Pipeline";
      if (title) title.textContent = "프로젝트 목록";
      if (subtitle) subtitle.textContent = "국가별 주요 프로젝트의 단계, 규모, 관련 기사를 이어서 확인합니다.";
    } else {
      if (eyebrow) eyebrow.textContent = "Market News";
      if (title) title.textContent = "해외 건설시장 뉴스";
      if (subtitle) subtitle.textContent = "주요 건설·인프라 시장뉴스와 프로젝트 연결 정보를 확인합니다.";
    }
  }

  function patchMarketDateHandling() {
    if (!document.querySelector(".market-dashboard")) return;

    try {
      const versionKey = "marketDateFilterSchemaVersion";
      const currentVersion = "20260623-ui-polish";
      if (localStorage.getItem(versionKey) !== currentVersion) {
        const saved = JSON.parse(localStorage.getItem("dashboardFilters") || "{}");
        saved.sort = saved.sort || "중요도:desc";
        saved.highPriorityOnly = false;
        localStorage.setItem("dashboardFilters", JSON.stringify(saved));
        localStorage.setItem(versionKey, currentVersion);
      }
    } catch (error) {
      console.warn("Failed to refresh market filter defaults:", error);
    }

    window.parseSheetDate = function patchedParseSheetDate(value) {
      if (!value) return null;
      if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
      if (typeof value === "number" && Number.isFinite(value)) {
        if (value > 20000) return new Date(Math.round((value - 25569) * 86400 * 1000));
        return null;
      }

      const text = String(value).trim();
      const dateCtorMatch = text.match(/^Date\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
      if (dateCtorMatch) return new Date(Number(dateCtorMatch[1]), Number(dateCtorMatch[2]), Number(dateCtorMatch[3]));

      const normalized = text
        .replace(/[년월]/g, "-")
        .replace(/일/g, "")
        .replace(/[./]/g, "-")
        .replace(/\s+/g, "")
        .replace(/-+/g, "-")
        .replace(/-$/, "");
      const isoMatch = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (isoMatch) return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));

      const parsed = new Date(text);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    window.setRelativeDateRange = function patchedSetRelativeDateRange(days, shouldApply = true) {
      const end = new Date();
      const start = new Date(end);
      start.setDate(end.getDate() - Number(days || 7));
      const startDate = document.getElementById("startDate");
      const endDate = document.getElementById("endDate");
      if (startDate) startDate.value = toDateInputValueSafe(start);
      if (endDate) endDate.value = toDateInputValueSafe(end);
      if (typeof window.syncDatePresetButtons === "function") window.syncDatePresetButtons(Number(days || 7));
      if (shouldApply && typeof window.applyFilters === "function") {
        window.state?.expanded?.clear?.();
        window.applyFilters();
      }
    };

    window.getCurrentPresetDays = function patchedGetCurrentPresetDays() {
      const startDate = document.getElementById("startDate");
      const endDate = document.getElementById("endDate");
      if (!startDate?.value || !endDate?.value) return null;
      const start = new Date(`${startDate.value}T00:00:00`);
      const end = new Date(`${endDate.value}T00:00:00`);
      const diff = Math.round((end.getTime() - start.getTime()) / 86400000);
      return diff > 0 ? diff : null;
    };

    window.getPresetLabel = function patchedGetPresetLabel(days) {
      if (days === 7) return "최근 1주일";
      if (days === 30) return "최근 1개월";
      if (days === 90) return "최근 3개월";
      if (days === 365) return "최근 1년";
      return "";
    };
  }

  function toDateInputValueSafe(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function patchTopNewsCards() {
    if (!document.querySelector(".market-dashboard")) return;
    if (typeof window.createTopNewsCard !== "function") return;

    window.createTopNewsCard = function patchedCreateTopNewsCard(row, rank = 1) {
      const article = document.createElement("article");
      article.className = "top-news-card top-news-card-expandable";
      const title = row["제목(한글)"] || row["제목(원문)"] || "제목 없음";
      const dateText = typeof window.formatDate === "function" ? window.formatDate(row._publishedDate) : "";
      const infoClass = row["정보 분류"] || "-";
      const topic = row["주제"] || "-";
      const isProject = infoClass === "프로젝트 정보" && (row["프로젝트명"] || row["프로젝트 고유값"]);
      const projectUrl = isProject ? buildProjectDetailUrlSafe(row) : "";
      const sourceLink = row["출처링크"]
        ? `<a class="top-news-source-link" href="${escapeAttributeSafe(row["출처링크"])}" target="_blank" rel="noreferrer">원문 확인</a>`
        : "";
      const projectBlock = isProject
        ? `<div class="top-news-project-link"><span>프로젝트명</span><strong>${escapeHtmlSafe(row["프로젝트명"] || "프로젝트명 미확인")}</strong><a href="${escapeAttributeSafe(projectUrl)}">프로젝트 상세 페이지</a></div>`
        : "";

      article.innerHTML = `
        <button type="button" class="top-news-toggle" aria-expanded="false">
          <div class="top-news-meta top-news-badge-row">
            <span class="top-news-rank">TOP ${rank}</span>
            <span class="top-news-badge">${escapeHtmlSafe(row["국가"] || "-")}</span>
            <span class="top-news-badge">${escapeHtmlSafe(row["섹터"] || "-")}</span>
            <span class="top-news-badge">${escapeHtmlSafe(dateText || row["원문게재일"] || "-")}</span>
          </div>
          <h3>${escapeHtmlSafe(title)}</h3>
          <div class="top-news-tag-row">
            <span class="top-news-badge info-badge">${escapeHtmlSafe(infoClass)}</span>
            <span class="top-news-badge keyword-badge">${escapeHtmlSafe(topic)}</span>
          </div>
          ${projectBlock}
        </button>
        <div class="top-news-detail" hidden>
          <p>${escapeHtmlSafe(row["내용"] || "상세 내용이 없습니다.")}</p>
          <div class="top-news-detail-meta">
            ${row["관련 단계"] ? `<span class="top-news-badge">${escapeHtmlSafe(row["관련 단계"])}</span>` : ""}
            ${sourceLink}
          </div>
        </div>
      `;

      const toggle = article.querySelector(".top-news-toggle");
      const detail = article.querySelector(".top-news-detail");
      toggle.addEventListener("click", (event) => {
        if (event.target.closest("a")) return;
        const expanded = article.classList.toggle("is-expanded");
        toggle.setAttribute("aria-expanded", String(expanded));
        detail.hidden = !expanded;
        scheduleInterestEnhance();
      });
      return article;
    };
  }

  function buildProjectDetailUrlSafe(row) {
    const params = new URLSearchParams();
    if (row?.["프로젝트 고유값"]) params.set("id", row["프로젝트 고유값"]);
    if (row?.["프로젝트명"]) params.set("name", row["프로젝트명"]);
    if (row?.["국가"]) params.set("country", row["국가"]);
    if (row?.["섹터"]) params.set("sector", row["섹터"]);
    return `./project.html?${params.toString()}`;
  }

  function injectPolishStyles() {
    if (document.getElementById("monitorUiPolish20260623")) return;
    const style = document.createElement("style");
    style.id = "monitorUiPolish20260623";
    style.textContent = `
      .filter-top-actions { display: flex; justify-content: flex-end; margin: 0 0 10px; }
      .top-reset-button { min-height: 32px; padding: 0 12px; border: 1px solid rgba(18,83,164,.18); border-radius: 999px; color: #243a57; background: rgba(255,255,255,.9); font-size: .76rem; font-weight: 900; cursor: pointer; }
      .top-reset-button:hover { color: #fff; border-color: rgba(22,166,201,.58); background: #135c9b; }
      .filter-mini-actions { display: flex; justify-content: flex-end; gap: 6px; padding: 7px 9px 0; }
      .filter-mini-actions button { border: 0; color: #66788f; background: transparent; font-size: .7rem; font-weight: 850; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
      .filter-mini-actions button:hover { color: #135c9b; }

      @media (min-width: 1161px) {
        .market-filter-panel, body:has(#projectBody) .control-panel { max-height: calc(100vh - 24px); overflow: hidden; overscroll-behavior: contain; scrollbar-gutter: stable; }
        .market-filter-panel:hover, .market-filter-panel:focus-within, body:has(#projectBody) .control-panel:hover, body:has(#projectBody) .control-panel:focus-within { overflow-y: auto; }
        .market-dashboard .summary-grid, body:has(#projectBody) .summary-grid { position: sticky; top: 12px; z-index: 18; width: min(760px, 100%); margin-left: auto; backdrop-filter: blur(8px); }
      }

      .market-dashboard .summary-grid, body:has(#projectBody) .summary-grid { gap: 6px; }
      .market-dashboard .summary-item, body:has(#projectBody) .summary-item { min-height: 46px; padding: 7px 9px; border-radius: 8px; }
      .market-dashboard .summary-item::before, body:has(#projectBody) .summary-item::before { width: 15px; height: 15px; top: 7px; right: 7px; border-radius: 6px; }
      .market-dashboard .summary-item span, body:has(#projectBody) .summary-item span { font-size: .62rem; line-height: 1.15; }
      .market-dashboard .summary-item strong, body:has(#projectBody) .summary-item strong { margin-top: 3px; font-size: clamp(.92rem, 1.1vw, 1.14rem); letter-spacing: 0; }

      .market-dashboard .field:has(#sortSelect), body:has(#projectBody) .field:has(#sortSelect) { order: -5; }
      body:has(#projectBody) .field-toggle:has(#includeSmallCost) { order: 50; }
      body:has(#projectBody) .scale-toolbar { display: none !important; }
      body:has(#projectBody) .scale-infographic { margin-bottom: 10px; }
      .market-results-section > .section-head { display: none !important; }

      .top-news-card-expandable { overflow: hidden; }
      .top-news-toggle { display: block; width: 100%; padding: 0; border: 0; color: inherit; background: transparent; text-align: left; cursor: pointer; }
      .top-news-card-expandable.is-expanded { border-color: rgba(22,166,201,.44); box-shadow: 0 18px 38px rgba(23,105,194,.16); }
      .top-news-badge-row, .top-news-tag-row, .top-news-detail-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
      .top-news-tag-row { margin: 8px 0 0; }
      .top-news-badge, .top-news-rank, .top-news-source-link { display: inline-flex; align-items: center; min-height: 24px; padding: 0 8px; border: 1px solid rgba(19,92,155,.16); border-radius: 999px; color: #123a5c; background: #eef7fc; font-size: .7rem; font-weight: 900; line-height: 1; text-decoration: none; }
      .top-news-rank { color: #fff; border-color: transparent; background: #135c9b; }
      .info-badge { color: #0f365e; background: #e9f2ff; }
      .keyword-badge { color: #0b5d5e; background: #e7f7f2; }
      .top-news-project-link { display: grid; gap: 5px; margin-top: 10px; padding: 10px; border: 1px solid rgba(19,92,155,.16); border-radius: 8px; background: rgba(248,251,255,.92); }
      .top-news-project-link span { color: #66788f; font-size: .66rem; font-weight: 900; }
      .top-news-project-link strong { color: #10243d; font-size: .84rem; line-height: 1.3; }
      .top-news-project-link a { justify-self: start; min-height: 28px; padding: 0 10px; display: inline-flex; align-items: center; border-radius: 999px; color: #fff; background: #135c9b; font-size: .72rem; font-weight: 900; text-decoration: none; }
      .top-news-detail { margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(18,83,164,.14); }
      .top-news-detail p { display: block; min-height: 0; margin: 0 0 10px; color: #243a57; -webkit-line-clamp: unset; }

      .filter-collapse { border: 1px solid rgba(42,65,97,.13); border-radius: 10px; background: rgba(255,255,255,.66); }
      .filter-collapse summary { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 34px; padding: 0 10px; color: #213955; cursor: pointer; list-style: none; }
      .filter-collapse summary::-webkit-details-marker { display: none; }
      .filter-collapse summary::after { content: '⌄'; color: #6a7d92; font-size: .78rem; font-weight: 950; transition: transform 160ms ease; }
      .filter-collapse[open] summary::after { transform: rotate(180deg); }
      .filter-title { flex: 0 0 auto; font-size: .76rem; font-weight: 950; letter-spacing: 0; }
      .filter-summary { flex: 1 1 auto; overflow: hidden; color: #758398; font-size: .7rem; font-weight: 850; text-align: right; text-overflow: ellipsis; white-space: nowrap; }
      .filter-summary.has-active-filter, .filter-collapse.has-active-filter .filter-title { color: #135c9b; }
      .filter-collapse .checkbox-filter { margin: 0 7px 7px; }
      .checkbox-filter.is-country-grouped { display: grid; gap: 10px; }
      .country-chip-group { display: grid; gap: 7px; padding: 8px; border: 1px solid rgba(18,83,164,.08); border-radius: 12px; background: rgba(255,255,255,.62); }
      .country-chip-group-title { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 24px; color: #1253a4; border-radius: 8px; background: rgba(18,83,164,.09); font-size: .74rem; font-weight: 950; }
      .country-chip-group-list { display: flex; flex-wrap: wrap; gap: 6px; }

      @media (max-width: 1160px) {
        .market-dashboard .summary-grid, body:has(#projectBody) .summary-grid { position: static; width: 100%; margin-left: 0; }
        .market-filter-panel, body:has(#projectBody) .control-panel { max-height: none; overflow: visible; }
      }
    `;
    document.head.appendChild(style);
  }

  function buildCollapsibleFilters() {
    document.querySelectorAll(".field-wide").forEach((field) => {
      if (field.querySelector(".filter-collapse")) return;
      const label = field.querySelector(":scope > .field-label");
      const filter = field.querySelector(":scope > .checkbox-filter");
      if (!label || !filter) return;

      const details = document.createElement("details");
      details.className = "filter-collapse";
      const summary = document.createElement("summary");
      const title = document.createElement("span");
      title.className = "filter-title";
      title.textContent = label.textContent.trim();
      const selectedSummary = document.createElement("span");
      selectedSummary.className = "filter-summary";
      selectedSummary.textContent = "전체";
      const actions = document.createElement("div");
      actions.className = "filter-mini-actions";
      actions.innerHTML = `<button type="button" data-filter-action="select-all">전체 선택</button><button type="button" data-filter-action="clear-all">전체 해제</button>`;

      summary.append(title, selectedSummary);
      details.append(summary, actions, filter);
      label.remove();
      field.append(details);

      actions.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-filter-action]");
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        setAllCheckboxes(filter, button.dataset.filterAction === "select-all");
        updateFilterSummary(details);
      });

      filter.addEventListener("change", () => updateFilterSummary(details));
      new MutationObserver(() => {
        updateFilterSummary(details);
        if (filter.id === COUNTRY_FILTER_ID) scheduleCountryGrouping(filter);
      }).observe(filter, { childList: true, subtree: true, attributes: true, attributeFilter: ["checked"] });

      updateFilterSummary(details);
      if (filter.id === COUNTRY_FILTER_ID) scheduleCountryGrouping(filter);
    });
  }

  function moveProjectFilterControls() {
    const projectGrid = document.querySelector(".field-grid-projects");
    if (!projectGrid) return;
    const sortField = projectGrid.querySelector(".field:has(#sortSelect)");
    const costField = projectGrid.querySelector(".field-toggle:has(#includeSmallCost)");
    if (sortField && projectGrid.firstElementChild !== sortField) projectGrid.prepend(sortField);
    if (costField && projectGrid.lastElementChild !== costField) projectGrid.append(costField);
  }

  function setAllCheckboxes(filter, checked) {
    filter.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      input.checked = checked;
    });
    filter.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function scheduleAllFilterSummaries() {
    document.querySelectorAll(".filter-collapse").forEach(updateFilterSummary);
  }

  function forceResetFilters() {
    const isMarket = Boolean(document.querySelector(".market-dashboard"));
    const keywordInput = document.getElementById("keywordInput");
    const sortSelect = document.getElementById("sortSelect");
    if (keywordInput) keywordInput.value = "";
    document.querySelectorAll(".checkbox-filter").forEach((filter) => setAllCheckboxes(filter, false));

    if (isMarket) {
      const startDate = document.getElementById("startDate");
      const endDate = document.getElementById("endDate");
      if (startDate) startDate.value = "";
      if (endDate) endDate.value = "";
      document.querySelectorAll(".date-preset-button").forEach((button) => {
        button.classList.remove("is-active");
        button.setAttribute("aria-pressed", "false");
      });
      if (sortSelect) sortSelect.value = "중요도:desc";
      try {
        const saved = JSON.parse(localStorage.getItem("dashboardFilters") || "{}");
        Object.assign(saved, { keyword: "", startDate: "", endDate: "", region: [], country: [], sector: [], infoClass: [], sort: "중요도:desc", highPriorityOnly: false });
        localStorage.setItem("dashboardFilters", JSON.stringify(saved));
      } catch (error) {
        console.warn("Failed to clear saved market filters:", error);
      }
    } else {
      const includeSmallCost = document.getElementById("includeSmallCost");
      const includeUnknownCost = document.getElementById("includeUnknownCost");
      if (includeSmallCost) includeSmallCost.checked = true;
      if (includeUnknownCost) includeUnknownCost.checked = true;
      if (sortSelect) sortSelect.value = "cost:desc";
    }

    if (typeof window.applyFilters === "function") window.setTimeout(() => window.applyFilters(), 0);
  }

  function updateFilterSummary(details) {
    const summary = details.querySelector(".filter-summary");
    if (!summary) return;
    const checked = [...details.querySelectorAll('input[type="checkbox"]:checked')].map(
      (input) => input.closest("label")?.textContent.trim() || input.value,
    );

    if (!checked.length) {
      summary.textContent = "전체";
      summary.classList.remove("has-active-filter");
      details.classList.remove("has-active-filter");
      return;
    }

    const total = details.querySelectorAll('input[type="checkbox"]').length;
    summary.textContent = checked.length === total && total > 0 ? "전체 선택" : checked.length === 1 ? checked[0] : `${checked[0]} 외 ${checked.length - 1}`;
    summary.classList.add("has-active-filter");
    details.classList.add("has-active-filter");
  }

  function scheduleCountryGrouping(container) {
    const activeTimer = groupingTimers.get(container);
    if (activeTimer) clearTimeout(activeTimer);
    const timer = setTimeout(() => groupCountryChips(container), 0);
    groupingTimers.set(container, timer);
  }

  function groupCountryChips(container) {
    if (!container || container.dataset.grouping === "true") return;
    const labels = [...container.querySelectorAll(":scope > label.check-chip")];
    if (!labels.length) {
      container.classList.remove(GROUPED_CLASS);
      return;
    }

    container.dataset.grouping = "true";
    container.innerHTML = "";
    container.classList.add(GROUPED_CLASS);
    const groups = new Map();
    labels.forEach((label) => {
      const value = label.querySelector('input[type="checkbox"]')?.value || label.textContent.trim();
      const key = getKoreanGroupKey(value);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(label);
    });

    [...groups.keys()].sort(compareKoreanGroupKeys).forEach((key) => {
      const group = document.createElement("div");
      group.className = "country-chip-group";
      const heading = document.createElement("span");
      heading.className = "country-chip-group-title";
      heading.textContent = key;
      const chips = document.createElement("div");
      chips.className = "country-chip-group-list";
      groups.get(key).forEach((label) => chips.appendChild(label));
      group.append(heading, chips);
      container.appendChild(group);
    });

    delete container.dataset.grouping;
  }

  function bindGlobalResetButtons() {
    document.querySelectorAll("[data-reset-filter]").forEach((button) => {
      if (button.dataset.resetBound === "true") return;
      button.dataset.resetBound = "true";
      button.addEventListener("click", () => document.getElementById("resetButton")?.click());
    });
  }

  function bindResetFix() {
    const resetButton = document.getElementById("resetButton");
    if (!resetButton || resetButton.dataset.forceResetBound === "true") return;
    resetButton.dataset.forceResetBound = "true";
    resetButton.addEventListener("click", () => window.setTimeout(forceResetFilters, 0));
  }

  function installFastInterestRefresh() {
    const run = () => scheduleInterestEnhance();
    document.addEventListener("click", (event) => {
      if (event.target.closest(".detail-button") || event.target.closest("tr") || event.target.closest(".top-news-toggle")) {
        [0, 16, 40, 90, 180].forEach((delay) => setTimeout(run, delay));
      }
    }, true);

    const installObserver = () => {
      const target = document.getElementById("resultBody") || document.getElementById("topNewsCards");
      if (!target || target.dataset.fastInterestObserved === "true") return;
      target.dataset.fastInterestObserved = "true";
      new MutationObserver(() => scheduleInterestEnhance()).observe(target, { childList: true, subtree: true });
    };
    installObserver();
    [200, 700, 1500].forEach((delay) => setTimeout(installObserver, delay));
  }

  function scheduleInterestEnhance() {
    const feature = window.InterestFeature;
    if (!feature?.enabled) return;
    requestAnimationFrame(() => {
      feature.enhanceAll?.();
      feature.hydrate?.();
    });
  }

  function getKoreanGroupKey(value) {
    const text = String(value || "").trim();
    if (!text) return "기타";
    const first = text[0];
    const code = first.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) {
      const initialIndex = Math.floor((code - 0xac00) / 588);
      return ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"][initialIndex] || "기타";
    }
    const upper = first.toUpperCase();
    if (upper >= "A" && upper <= "Z") return "A-Z";
    if (upper >= "0" && upper <= "9") return "0-9";
    return "기타";
  }

  function compareKoreanGroupKeys(a, b) {
    const order = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ", "A-Z", "0-9", "기타"];
    return order.indexOf(a) - order.indexOf(b);
  }

  function escapeHtmlSafe(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttributeSafe(value) {
    return escapeHtmlSafe(value).replaceAll("`", "&#096;");
  }
})();
