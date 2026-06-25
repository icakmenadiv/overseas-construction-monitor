(() => {
  const DAY_MS = 86400000;
  const PRESET_LENGTHS = new Set([7, 30, 90, 365]);

  window.parseSheetDate = function parseSheetDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === "number" && Number.isFinite(value)) {
      return value > 20000 ? new Date(Math.round((value - 25569) * DAY_MS)) : null;
    }

    const text = String(value).trim();
    const dateCtorMatch = text.match(/^Date\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (dateCtorMatch) {
      return new Date(Number(dateCtorMatch[1]), Number(dateCtorMatch[2]), Number(dateCtorMatch[3]));
    }

    const sheetDateMatch = text.match(/(\d{4})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{1,2})/);
    if (sheetDateMatch) {
      return new Date(Number(sheetDateMatch[1]), Number(sheetDateMatch[2]) - 1, Number(sheetDateMatch[3]));
    }

    const koreanDateMatch = text.match(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
    if (koreanDateMatch) {
      return new Date(Number(koreanDateMatch[1]), Number(koreanDateMatch[2]) - 1, Number(koreanDateMatch[3]));
    }

    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  refreshSavedPresetDateRange();

  function refreshSavedPresetDateRange() {
    try {
      const saved = JSON.parse(localStorage.getItem("dashboardFilters") || "{}");
      if (!saved.startDate || !saved.endDate) return;

      const start = parseInputDate(saved.startDate);
      const end = parseInputDate(saved.endDate);
      const today = startOfToday();
      if (!start || !end || end >= today) return;

      const spanDays = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
      if (!PRESET_LENGTHS.has(spanDays)) return;

      const nextStart = new Date(today);
      nextStart.setDate(today.getDate() - spanDays + 1);
      saved.startDate = toDateInputValue(nextStart);
      saved.endDate = toDateInputValue(today);
      localStorage.setItem("dashboardFilters", JSON.stringify(saved));
    } catch (error) {
      console.warn("Failed to refresh saved market date preset:", error);
    }
  }

  function parseInputDate(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  function startOfToday() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function toDateInputValue(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
})();