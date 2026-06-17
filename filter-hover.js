(() => {
  const COUNTRY_FILTER_ID = "countryFilter";
  const GROUPED_CLASS = "is-country-grouped";
  const groupingTimers = new WeakMap();

  patchMarketDateHandling();
  patchTopNewsCards();

  function patchMarketDateHandling() {
    if (!document.querySelector(".market-dashboard")) return;

    try {
      const versionKey = "marketDateFilterSchemaVersion";
      const currentVersion = "20260617-date-inclusive-v3";
      if (localStorage.getItem(versionKey) !== currentVersion) {
        const saved = JSON.parse(localStorage.getItem("dashboardFilters") || "{}");
        saved.startDate = "";
        saved.endDate = "";
        saved.sort = saved.sort || "중요도:desc";
        saved.highPriorityOnly = false;
        localStorage.setItem("dashboardFilters", JSON.stringify(saved));
        localStorage.setItem(versionKey, currentVersion);
      }
    } catch (error) {
      console.warn("Failed to reset market date filter defaults:", error);
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
      if (dateCtorMatch) {
        return new Date(Number(dateCtorMatch[1]), Number(dateCtorMatch[2]), Number(dateCtorMatch[3]));
      }

      const normalized = text
        .replace(/[년월]/g, "-")
        .replace(/일/g, "")
        .replace(/[./]/g, "-")
        .replace(/\s+/g, "")
        .replace(/-+/g, "-")
        .replace(/-$/, "");

      const isoMatch = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (isoMatch) {
        return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
      }

      const parsed = new Date(text);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    window.setRelativeDateRange = function patchedSetRelativeDateRange(days, shouldApply = true) {
      const end = getMarketRangeEndDate();
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

  function getMarketRangeEndDate() {
    return new Date();
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

    window.createTopNewsCard = function patchedCreateTopNewsCard(row) {
      const article = document.createElement("article");
      article.className = "top-news-card top-news-card-expandable";
      const title = row["제목(한글)"] || row["제목(원문)"] || "제목 없음";
      const dateText = typeof window.formatDate === "function" ? window.formatDate(row._publishedDate) : "";
      const sourceLink = row["출처링크"]
        ? `<a class="top-news-source-link" href="${escapeAttributeSafe(row["출처링크"])}" target="_blank" rel="noreferrer">원문 확인</a>`
        : "";

      article.innerHTML = `
        <button type="button" class="top-news-toggle" aria-expanded="false">
          <div class="top-news-meta">
            <span>${escapeHtmlSafe(row["국가"] || "-")}</span>
            <span>${escapeHtmlSafe(row["섹터"] || "-")}</span>
            <span>${escapeHtmlSafe(dateText || row["원문게재일"] || "-")}</span>
          </div>
          <h3>${escapeHtmlSafe(title)}</h3>
          <p>${escapeHtmlSafe(row["주제"] || row["정보 분류"] || "핵심 키워드 없음")}</p>
        </button>
        <div class="top-news-detail" hidden>
          <p>${escapeHtmlSafe(row["내용"] || "상세 내용이 없습니다.")}</p>
          <div class="top-news-detail-meta">
            ${row["정보 분류"] ? `<span>${escapeHtmlSafe(row["정보 분류"])}</span>` : ""}
            ${row["관련 단계"] ? `<span>${escapeHtmlSafe(row["관련 단계"])}</span>` : ""}
            ${sourceLink}
          </div>
        </div>
      `;

      const toggle = article.querySelector(".top-news-toggle");
      const detail = article.querySelector(".top-news-detail");
      toggle.addEventListener("click", () => {
        const expanded = article.classList.toggle("is-expanded");
        toggle.setAttribute("aria-expanded", String(expanded));
        detail.hidden = !expanded;
      });
      return article;
    };
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

  function injectFilterActionStyles() {
    if (document.getElementById("filterQuickActionStyles")) return;
    const style = document.createElement("style");
    style.id = "filterQuickActionStyles";
    style.textContent = `
      .filter-top-actions {
        display: flex;
        justify-content: flex-end;
        margin: 0 0 14px;
      }

      .top-reset-button {
        min-height: 34px;
        padding: 0 13px;
        border: 1px solid rgba(18, 83, 164, 0.18);
        border-radius: 999px;
        color: var(--slate-700);
        background: rgba(255, 255, 255, 0.86);
        font-size: 0.78rem;
        font-weight: 900;
        cursor: pointer;
      }

      .top-reset-button:hover {
        color: var(--white);
        border-color: rgba(22, 166, 201, 0.58);
        background: linear-gradient(135deg, var(--blue-700), var(--cyan-500));
      }

      .filter-mini-actions {
        display: flex;
        justify-content: flex-end;
        gap: 6px;
        padding: 8px 10px 0;
      }

      .filter-mini-actions button {
        border: 0;
        color: var(--slate-500);
        background: transparent;
        font-size: 0.72rem;
        font-weight: 850;
        text-decoration: underline;
        text-underline-offset: 3px;
        cursor: pointer;
      }

      .filter-mini-actions button:hover {
        color: var(--blue-700);
      }

      .top-news-card-expandable {
        overflow: hidden;
      }

      .top-news-toggle {
        display: block;
        width: 100%;
        padding: 0;
        border: 0;
        color: inherit;
        background: transparent;
        text-align: left;
        cursor: pointer;
      }

      .top-news-card-expandable.is-expanded {
        border-color: rgba(22, 166, 201, 0.44);
        box-shadow: 0 18px 38px rgba(23, 105, 194, 0.18);
      }

      .top-news-detail {
        margin-top: 14px;
        padding-top: 14px;
        border-top: 1px solid rgba(18, 83, 164, 0.14);
      }

      .top-news-detail p {
        display: block;
        min-height: 0;
        margin: 0 0 10px;
        color: var(--slate-700);
        -webkit-line-clamp: unset;
      }

      .top-news-detail-meta {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
        font-size: 0.76rem;
        font-weight: 850;
      }

      .top-news-detail-meta span,
      .top-news-source-link {
        display: inline-flex;
        align-items: center;
        min-height: 24px;
        padding: 0 9px;
        border-radius: 999px;
        color: var(--blue-700);
        background: rgba(49, 213, 233, 0.12);
        text-decoration: none;
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
      actions.innerHTML = `
        <button type="button" data-filter-action="select-all">전체 선택</button>
        <button type="button" data-filter-action="clear-all">전체 해제</button>
      `;

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

      updateFilterSummary(details);
      if (filter.id === COUNTRY_FILTER_ID) scheduleCountryGrouping(filter);

      filter.addEventListener("change", () => updateFilterSummary(details));
      new MutationObserver(() => {
        updateFilterSummary(details);
        if (filter.id === COUNTRY_FILTER_ID) scheduleCountryGrouping(filter);
      }).observe(filter, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["checked"],
      });
    });
  }

  function setAllCheckboxes(filter, checked) {
    filter.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      input.checked = checked;
    });
    filter.dispatchEvent(new Event("change", { bubbles: true }));
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
        saved.keyword = "";
        saved.startDate = "";
        saved.endDate = "";
        saved.region = [];
        saved.country = [];
        saved.sector = [];
        saved.infoClass = [];
        saved.sort = "중요도:desc";
        saved.highPriorityOnly = false;
        localStorage.setItem("dashboardFilters", JSON.stringify(saved));
      } catch (error) {
        console.warn("Failed to clear saved market filters:", error);
      }
      if (typeof window.applyFilters === "function") window.setTimeout(() => window.applyFilters(), 0);
    } else {
      const includeSmallCost = document.getElementById("includeSmallCost");
      const includeUnknownCost = document.getElementById("includeUnknownCost");
      if (includeSmallCost) includeSmallCost.checked = true;
      if (includeUnknownCost) includeUnknownCost.checked = true;
      if (sortSelect) sortSelect.value = "cost:desc";
      if (typeof window.applyFilters === "function") window.setTimeout(() => window.applyFilters(), 0);
    }
  }

  function updateFilterSummary(details) {
    const summary = details.querySelector(".filter-summary");
    const checked = [...details.querySelectorAll('input[type="checkbox"]:checked')].map(
      (input) => input.closest("label")?.textContent.trim() || input.value,
    );
    if (!summary) return;

    if (!checked.length) {
      summary.textContent = "전체";
      summary.classList.remove("has-active-filter");
      details.classList.remove("has-active-filter");
      return;
    }

    const total = details.querySelectorAll('input[type="checkbox"]').length;
    if (checked.length === total && total > 0) {
      summary.textContent = "전체 선택";
    } else {
      summary.textContent = checked.length === 1 ? checked[0] : `${checked[0]} 외 ${checked.length - 1}`;
    }
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

  injectFilterActionStyles();
  buildCollapsibleFilters();
  bindGlobalResetButtons();
  document.addEventListener("DOMContentLoaded", bindResetFix);

  document.addEventListener("toggle", (event) => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement) || !details.classList.contains("filter-collapse")) {
      return;
    }
    requestAnimationFrame(() => details.classList.toggle("is-open", details.open));
  }, true);
})();
