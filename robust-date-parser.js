(() => {
  const originalParseSheetDate = typeof parseSheetDate === "function" ? parseSheetDate : null;

  window.parseSheetDate = parseSheetDate = function robustParseSheetDate(value) {
    const parsed = parseFlexibleDate(value);
    if (parsed) return parsed;
    return originalParseSheetDate ? originalParseSheetDate(value) : null;
  };

  function parseFlexibleDate(value) {
    if (value == null || value === "") return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

    const raw = String(value).trim();
    if (!raw) return null;

    const text = raw
      .replace(/[\u2010-\u2015]/g, "-")
      .replace(/\s+/g, " ")
      .trim();

    const dateCtorMatch = text.match(/^Date\((\d{4}),\s*(\d{1,2}),\s*(\d{1,2})/);
    if (dateCtorMatch) {
      return validDate(Number(dateCtorMatch[1]), Number(dateCtorMatch[2]) + 1, Number(dateCtorMatch[3]));
    }

    const koreanMatch = text.match(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일?/);
    if (koreanMatch) {
      return validDate(Number(koreanMatch[1]), Number(koreanMatch[2]), Number(koreanMatch[3]));
    }

    const ymdCompact = text.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (ymdCompact) {
      return validDate(Number(ymdCompact[1]), Number(ymdCompact[2]), Number(ymdCompact[3]));
    }

    const ymdSeparated = text.match(/(\d{4})\s*[.\/\-]\s*(\d{1,2})\s*[.\/\-]\s*(\d{1,2})/);
    if (ymdSeparated) {
      return validDate(Number(ymdSeparated[1]), Number(ymdSeparated[2]), Number(ymdSeparated[3]));
    }

    const dmySeparated = text.match(/(\d{1,2})\s*[.\/\-]\s*(\d{1,2})\s*[.\/\-]\s*(\d{4})/);
    if (dmySeparated) {
      const first = Number(dmySeparated[1]);
      const second = Number(dmySeparated[2]);
      const year = Number(dmySeparated[3]);
      if (first > 12) return validDate(year, second, first);
      if (second > 12) return validDate(year, first, second);
      return validDate(year, second, first);
    }

    const numeric = Number(text.replace(/,/g, ""));
    if (Number.isFinite(numeric)) {
      if (numeric > 20000 && numeric < 80000) {
        return excelSerialToDate(numeric);
      }
      if (numeric > 1_000_000_000_000) {
        const date = new Date(numeric);
        return Number.isNaN(date.getTime()) ? null : stripTime(date);
      }
    }

    const englishDate = new Date(text);
    if (!Number.isNaN(englishDate.getTime())) return stripTime(englishDate);

    return null;
  }

  function excelSerialToDate(serial) {
    const utcDays = Math.floor(serial - 25569);
    const utcValue = utcDays * 86400 * 1000;
    const date = new Date(utcValue);
    return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  }

  function validDate(year, month, day) {
    if (!year || !month || !day) return null;
    if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return stripTime(date);
  }

  function stripTime(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
})();
