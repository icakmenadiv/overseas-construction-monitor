(() => {
  const OPEN_DELAY_MS = 180;
  const CLOSE_DELAY_MS = 300;
  const timers = new WeakMap();

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
    const details = target.closest(".filter-collapse");
    return details === target ? details : null;
  }

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
