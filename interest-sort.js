(() => {
  const HEART_COLUMNS = ["관심도", "관심도 집계", "관심수", "하트수", "관심도 수치"];
  const VIEW_COLUMNS = ["조회수", "조회 수", "viewCount", "views"];
  const HEART_WEIGHT = 5;

  window.normalizeRows = function normalizeRowsWithTrackingColumns(rows) {
    return rows
      .map((row, index) => {
        const normalized = { id: cleanValue(row?.["기사 고유값"] || String(index)) };
        Object.entries(row || {}).forEach(([key, value]) => {
          normalized[cleanValue(key)] = cleanValue(value);
        });
        normalized.id = normalized["기사 고유값"] || normalized.id || String(index);
        normalized._publishedDate = window.parseSheetDate?.(normalized["원문게재일"]) || parseSheetDateFallback(normalized["원문게재일"]);
        normalized._collectedDate = window.parseSheetDate?.(normalized["기사수집일"]) || parseSheetDateFallback(normalized["기사수집일"]);
        normalized._importanceScore = getImportanceScore(normalized["중요도"]);
        normalized._heartCount = getFirstPositiveNumber(normalized, HEART_COLUMNS);
        normalized._viewCount = getFirstPositiveNumber(normalized, VIEW_COLUMNS);
        normalized._interestScore = normalized._heartCount * HEART_WEIGHT + normalized._viewCount;
        return normalized;
      })
      .filter((row) => row["원문게재일"] || row["제목(한글)"] || row["제목(원문)"]);
  };

  window.sortRows = function sortRowsWithWeightedInterest(rows, sortValue) {
    const [key, direction] = String(sortValue || "중요도:desc").split(":");
    const multiplier = direction === "desc" ? -1 : 1;

    return [...rows].sort((a, b) => {
      if (key === "interest") {
        return (
          compareNumber(a._interestScore, b._interestScore, multiplier) ||
          compareNumber(a._heartCount, b._heartCount, multiplier) ||
          compareNumber(a._viewCount, b._viewCount, multiplier) ||
          compareNumber(getImportanceScore(a["중요도"]), getImportanceScore(b["중요도"]), multiplier) ||
          compareDateDesc(a._publishedDate, b._publishedDate) ||
          compareText(a["제목(한글)"] || a["제목(원문)"], b["제목(한글)"] || b["제목(원문)"])
        );
      }

      if (key === "중요도") {
        return (
          compareNumber(getImportanceScore(a["중요도"]), getImportanceScore(b["중요도"]), multiplier) ||
          compareDateDesc(a._publishedDate, b._publishedDate)
        );
      }

      if (key.includes("일")) {
        const timeA = (key === "원문게재일" ? a._publishedDate : a._collectedDate)?.getTime() || 0;
        const timeB = (key === "원문게재일" ? b._publishedDate : b._collectedDate)?.getTime() || 0;
        return (timeA - timeB) * multiplier;
      }

      if (key === "정보 분류") {
        const rank = getInfoClassRank(key, a[key]) - getInfoClassRank(key, b[key]);
        return (rank || compareText(a[key], b[key])) * multiplier;
      }

      return compareText(a[key], b[key]) * multiplier;
    });
  };

  window.getWeightedInterestScore = function getWeightedInterestScore(row) {
    const hearts = getFirstPositiveNumber(row, HEART_COLUMNS);
    const views = getFirstPositiveNumber(row, VIEW_COLUMNS);
    return hearts * HEART_WEIGHT + views;
  };

  function compareNumber(a, b, multiplier) {
    const diff = (Number(a || 0) - Number(b || 0)) * multiplier;
    return diff || 0;
  }

  function compareDateDesc(a, b) {
    return (b?.getTime?.() || 0) - (a?.getTime?.() || 0);
  }

  function compareText(a, b) {
    return cleanValue(a).localeCompare(cleanValue(b), "ko");
  }

  function getFirstPositiveNumber(row, columns) {
    for (const column of columns) {
      const value = parseNumber(row?.[column]);
      if (value > 0) return value;
    }
    return 0;
  }

  function getImportanceScore(value) {
    if (typeof window.getImportanceScore === "function") return window.getImportanceScore(value);
    const text = cleanValue(value);
    if (!text) return -1;
    const numberMatch = text.match(/-?\d+(?:\.\d+)?/);
    if (numberMatch) return Number(numberMatch[0]);
    if (/상|높|high|중요|우선/.test(text.toLowerCase())) return 90;
    if (/중|보통|medium/.test(text.toLowerCase())) return 50;
    if (/하|낮|low/.test(text.toLowerCase())) return 10;
    return -1;
  }

  function getInfoClassRank(key, value) {
    if (typeof window.getInfoClassRank === "function") return window.getInfoClassRank(value);
    return 999;
  }

  function parseNumber(value) {
    const match = cleanValue(value).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : 0;
  }

  function parseSheetDateFallback(value) {
    const text = cleanValue(value).replace(/^'+/, "").trim();
    const match = text.match(/(\d{4})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{1,2})/);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function cleanValue(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }
})();
