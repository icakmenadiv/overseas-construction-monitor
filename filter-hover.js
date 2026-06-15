(() => {
  const COUNTRY_FILTER_ID = "countryFilter";
  const GROUPED_CLASS = "is-country-grouped";
  const groupingTimers = new WeakMap();

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

      summary.append(title, selectedSummary);
      details.append(summary);
      details.append(filter);
      label.remove();
      field.append(details);

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

    summary.textContent = checked.length === 1 ? checked[0] : `${checked[0]} 외 ${checked.length - 1}`;
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

  buildCollapsibleFilters();

  document.addEventListener("toggle", (event) => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement) || !details.classList.contains("filter-collapse")) {
      return;
    }
    requestAnimationFrame(() => details.classList.toggle("is-open", details.open));
  }, true);
})();