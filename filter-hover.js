(() => {
  const OPEN_DELAY_MS = 180;
  const CLOSE_DELAY_MS = 300;
  const timers = new WeakMap();

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
      filter.addEventListener("change", () => updateFilterSummary(details));
      new MutationObserver(() => updateFilterSummary(details)).observe(filter, {
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

  function clearTimers(details) {
    const active = timers.get(details);
    if (!active) return;
    clearTimeout(active.openTimer);
    clearTimeout(active.closeTimer);
    timers.delete(details);
  }

  function rememberTimers(details, nextTimers) {
    const active = timers.get(details) || {};
    timers.set(details, { ...active, ...nextTimers });
  }

  function setOpenState(details, isOpen) {
    details.classList.toggle("is-open", isOpen);
    details.classList.toggle("is-closing", false);
  }

  function openFilter(details) {
    clearTimers(details);
    const openTimer = setTimeout(() => {
      details.open = true;
      requestAnimationFrame(() => setOpenState(details, true));
    }, OPEN_DELAY_MS);
    rememberTimers(details, { openTimer });
  }

  function closeFilter(details) {
    clearTimers(details);
    details.classList.toggle("is-open", false);
    details.classList.toggle("is-closing", true);
    const closeTimer = setTimeout(() => {
      details.open = false;
      details.classList.toggle("is-closing", false);
    }, CLOSE_DELAY_MS);
    rememberTimers(details, { closeTimer });
  }

  function getFilterDetails(event) {
    const target = event.target;
    if (!(target instanceof Element)) return null;
    return target.closest(".filter-collapse");
  }

  buildCollapsibleFilters();

  document.addEventListener(
    "mouseenter",
    (event) => {
      const details = getFilterDetails(event);
      if (!details) return;
      event.stopImmediatePropagation();
      openFilter(details);
    },
    true,
  );

  document.addEventListener(
    "mouseleave",
    (event) => {
      const details = getFilterDetails(event);
      if (!details) return;
      event.stopImmediatePropagation();
      closeFilter(details);
    },
    true,
  );

  document.addEventListener("toggle", (event) => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement) || !details.classList.contains("filter-collapse")) {
      return;
    }
    requestAnimationFrame(() => setOpenState(details, details.open));
  }, true);
})();
