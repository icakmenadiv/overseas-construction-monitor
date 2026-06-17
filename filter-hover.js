(() => {
  const COUNTRY_FILTER_ID = "countryFilter";
  const GROUPED_CLASS = "is-country-grouped";
  const groupingTimers = new WeakMap();

  patchMarketDateHandling();

  function patchMarketDateHandling() {
    if (!document.querySelector(".market-dashboard")) return;

    try {
      const versionKey = "marketDateFilterSchemaVersion";
      const currentVersion = "20260617-date-inclusive-v2";
      if (localStorage.getItem(versionKey) !== currentVersion) {
        const saved = JSON.parse(localStorage.getItem("dashboardFilters") || "{}");
        saved.startDate = "";
        saved.endDate = "";
        saved.sort = saved.sort || "중요도:desc";
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
  }

  function getMarketRangeEndDate() {
    const validDates = Array.isArray(window.state?.rows)
      ? window.state.rows.map((row) => row._publishedDate).filter((date) => date && !Number.isNaN(date.getTime()))
      : [];
    if (validDates.length) return new Date(Math.max(...validDates.map((date) => date.getTime())));
    return new Date();
  }

  function toDateInputValueSafe(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
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

  document.addEventListener("toggle", (event) => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement) || !details.classList.contains("filter-collapse")) {
      return;
    }
    requestAnimationFrame(() => details.classList.toggle("is-open", details.open));
  }, true);
})();
