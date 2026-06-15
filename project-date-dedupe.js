(() => {
  const getValue = (item, field) => item?.article?.[field] || item?.mapping?.[field] || "";
  const cleanValue = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
  const normalizeKey = (value) => cleanValue(value).toLowerCase();
  const articleDate = (item) => cleanValue(item?.mapping?.["기사일자"] || item?.article?.["원문게재일"]);
  const projectKey = (item) =>
    normalizeKey(
      getValue(item, "프로젝트 고유값") ||
        [getValue(item, "프로젝트명"), getValue(item, "국가"), getValue(item, "섹터")].join("|")
    );
  const titleText = (item) => cleanValue(getValue(item, "제목(원문)") || getValue(item, "제목(한글)"));
  const hasSeparatePackageSignal = (item) => {
    const text = titleText(item).toLowerCase();
    return /\b(lot|package|section|phase|segment|contract|work package|공구|구간|패키지|단계|lot\s*\d|lote|tramo)\b/.test(text);
  };
  const packageToken = (item) => {
    const text = titleText(item).toLowerCase();
    const match = text.match(/(?:lot|package|section|phase|segment|contract|공구|구간|패키지|단계|lote|tramo)\s*[-:º#]?\s*([a-z0-9]+(?:\s*[+&·,]\s*[a-z0-9]+)?)/i);
    return match ? match[0].replace(/\s+/g, " ").trim() : "";
  };
  const canMergeByDate = (current, candidate) => {
    const currentToken = packageToken(current);
    const candidateToken = packageToken(candidate);
    if (hasSeparatePackageSignal(current) && hasSeparatePackageSignal(candidate) && currentToken && candidateToken) {
      return currentToken === candidateToken;
    }
    return true;
  };
  const scoreItem = (item) => {
    let score = 0;
    if (item?.mapping?.["대표기사 여부"] === "Y") score += 100;
    if (getValue(item, "출처링크")) score += 20;
    if ((getValue(item, "내용") || "").length > 80) score += 10;
    if (getValue(item, "제목(원문)")) score += 5;
    return score;
  };
  const choosePreferred = (current, candidate) => (scoreItem(candidate) > scoreItem(current) ? candidate : current);

  window.collapseDuplicateArticleItems = (items = []) => {
    const kept = [];

    items.forEach((item) => {
      const dateKey = `${projectKey(item)}|${articleDate(item)}`;
      const existingIndex = kept.findIndex((keptItem) => `${projectKey(keptItem)}|${articleDate(keptItem)}` === dateKey && canMergeByDate(keptItem, item));

      if (existingIndex >= 0) {
        kept[existingIndex] = choosePreferred(kept[existingIndex], item);
        return;
      }

      kept.push(item);
    });

    return kept.sort(
      (a, b) =>
        (window.parseSheetDate?.(b.mapping?.["기사일자"])?.getTime() || 0) -
        (window.parseSheetDate?.(a.mapping?.["기사일자"])?.getTime() || 0),
    );
  };
})();
