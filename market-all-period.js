(() => {
  const SHEET_ID = "11WmfuDj7FSk5LRvEB2CArVETZOA9NgpySLYscG223-E";
  const SHEET_GID = "748239675";
  let cachedEarliestDate = null;

  function initAllPeriodPreset() {
    const button = document.querySelector('[data-period="all"]');
    if (!button) return;
    preloadEarliestPublishedDate();

    document.addEventListener(
      "click",
      async (event) => {
        const target = event.target.closest('[data-period="all"]');
        if (!target) return;

        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();

        const startDate = document.getElementById("startDate");
        const endDate = document.getElementById("endDate");
        const earliestDate = cachedEarliestDate || (await fetchEarliestPublishedDate());
        const today = new Date();

        if (startDate) {
          startDate.value = earliestDate ? toDateInputValue(earliestDate) : "";
          startDate.dispatchEvent(new Event("change", { bubbles: true }));
        }
        if (endDate) {
          endDate.value = toDateInputValue(today);
          endDate.dispatchEvent(new Event("change", { bubbles: true }));
        }

        document.querySelectorAll(".date-preset-button").forEach((preset) => {
          const active = preset === target;
          preset.classList.toggle("is-active", active);
          preset.setAttribute("aria-pressed", String(active));
        });

        if (window.state?.expanded?.clear) window.state.expanded.clear();
        if (typeof window.applyFilters === "function") window.applyFilters();
      },
      true,
    );
  }

  async function preloadEarliestPublishedDate() {
    try {
      cachedEarliestDate = await fetchEarliestPublishedDate();
    } catch (error) {
      console.warn("Earliest date preload failed:", error);
    }
  }

  async function fetchEarliestPublishedDate() {
    const fromDom = getEarliestPublishedDateFromDomRows();
    if (fromDom) return fromDom;

    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?gid=${SHEET_GID}&tqx=out:json`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const text = await response.text();
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}") + 1;
    const data = JSON.parse(text.substring(jsonStart, jsonEnd));
    const cols = data.table.cols.map((col) => col.label || "");
    const dateIndex = cols.indexOf("원문게재일");
    if (dateIndex === -1) return null;

    const dates = data.table.rows
      .map((row) => parseDateValue(row.c[dateIndex]?.f || row.c[dateIndex]?.v || ""))
      .filter((date) => date && !Number.isNaN(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    cachedEarliestDate = dates[0] || null;
    return cachedEarliestDate;
  }

  function getEarliestPublishedDateFromDomRows() {
    const rows = Array.isArray(window.state?.rows) ? window.state.rows : [];
    const dates = rows
      .map((row) => row._publishedDate)
      .filter((date) => date instanceof Date && !Number.isNaN(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    return dates[0] || null;
  }

  function parseDateValue(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === "number" && Number.isFinite(value)) {
      return value > 20000 ? new Date(Math.round((value - 25569) * 86400 * 1000)) : null;
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
  }

  function toDateInputValue(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  document.addEventListener("DOMContentLoaded", initAllPeriodPreset);
})();
