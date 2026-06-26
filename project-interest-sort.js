(() => {
  const HEART_COLUMNS = ["관심도", "관심도 집계", "관심수", "하트수", "관심도 수치"];
  const VIEW_COLUMNS = ["조회수", "조회 수", "views", "viewCount"];
  const IMPORTANCE_COLUMNS = ["최종 중요도 수치값", "중요도", "중요도 수치값"];
  const HEART_WEIGHT = 5;

  window.buildRepresentativeMeta = function buildAggregateProjectInterestMeta(rows) {
    const meta = {
      articleById: new Map(),
      projectById: new Map(),
      projectByName: new Map(),
    };

    (rows || []).forEach((row) => {
      const articleId = clean(row?.["기사 고유값"]);
      const projectId = clean(row?.["프로젝트 고유값"]);
      const projectName = clean(row?.["프로젝트명"]);
      const hearts = getFirstPositiveNumber(row, HEART_COLUMNS);
      const views = getFirstPositiveNumber(row, VIEW_COLUMNS);
      const importance = getFirstPositiveNumber(row, IMPORTANCE_COLUMNS);
      const articleScore = hearts * HEART_WEIGHT + views;
      const articleMeta = {
        topic: clean(row?.["주제"]),
        interestCount: hearts,
        heartCount: hearts,
        viewCount: views,
        importanceScore: importance,
        weightedInterestScore: articleScore,
      };

      if (articleId) meta.articleById.set(articleId, articleMeta);
      if (projectId) addProjectAggregate(meta.projectById, projectId, row, articleMeta);
      if (projectName) addProjectAggregate(meta.projectByName, projectName, row, articleMeta);
    });

    meta.get = (articleId) => meta.articleById.get(articleId) || {};
    return meta;
  };

  window.normalizeProject = function normalizeProjectWithAggregateInterest(row, representativeMeta = new Map()) {
    const costText = row["사업비(달러 기준 추정액)"] || "사업비 미확인";
    const costValue = parseCostValueSafe(costText);
    const latestDate = parseSheetDateSafe(row["최근 업데이트일"]);
    const latestDateText = formatDateSafe(latestDate) || row["최근 업데이트일"];
    const representativeArticleId = row["대표 기사 고유값"];
    const projectId = row["프로젝트 고유값"];
    const projectName = row["프로젝트명"];
    const representativeArticleMeta = representativeMeta.get?.(representativeArticleId) || {};
    const projectAggregate =
      representativeMeta.projectById?.get(clean(projectId)) ||
      representativeMeta.projectByName?.get(clean(projectName)) ||
      emptyAggregate();
    const representativeTopic = representativeArticleMeta.topic || projectAggregate.topic || "";

    return {
      projectId,
      name: projectName,
      region: row["지역"],
      country: row["국가"],
      sector: row["섹터"],
      owner: row["발주처"],
      costText,
      costValue,
      costKnown: costValue > 0 && !isUnknownCostSafe(costText),
      exchangeBasis: row["사업비 환산 환율 / 기준"],
      stage: row["현재 단계"] || "-",
      latestDate,
      latestDateText,
      representativeArticleId,
      representativeTopic,
      representativeInterestCount: projectAggregate.weightedInterestScore || representativeArticleMeta.weightedInterestScore || 0,
      aggregateHeartCount: projectAggregate.heartCount || 0,
      aggregateViewCount: projectAggregate.viewCount || 0,
      aggregateImportanceScore: projectAggregate.maxImportanceScore || representativeArticleMeta.importanceScore || 0,
      relatedArticleCount: projectAggregate.articleCount || 0,
      representativeInfoClass: row["대표 기사 정보 분류"] || "프로젝트 정보",
      note: row["비고"],
    };
  };

  window.sortProjects = function sortProjectsWithAggregateInterest(projects, sortValue) {
    const [key, direction] = String(sortValue || "cost:desc").split(":");
    const multiplier = direction === "desc" ? -1 : 1;
    return [...projects].sort((a, b) => {
      if (key === "cost") return compareNumber(a.costValue, b.costValue, multiplier);
      if (key === "interest") {
        return (
          compareNumber(a.representativeInterestCount, b.representativeInterestCount, multiplier) ||
          compareNumber(a.aggregateHeartCount, b.aggregateHeartCount, multiplier) ||
          compareNumber(a.aggregateViewCount, b.aggregateViewCount, multiplier) ||
          compareNumber(a.aggregateImportanceScore, b.aggregateImportanceScore, multiplier) ||
          compareDateDesc(a.latestDate, b.latestDate) ||
          compareNumber(a.costValue, b.costValue, -1) ||
          compareText(a.name, b.name)
        );
      }
      if (key === "latest") return compareDate(a.latestDate, b.latestDate, multiplier);
      if (key === "country") return compareText(a.country, b.country) * multiplier;
      return compareText(a.name, b.name) * multiplier;
    });
  };

  function addProjectAggregate(map, key, row, articleMeta) {
    const normalizedKey = clean(key);
    if (!normalizedKey) return;
    const current = map.get(normalizedKey) || emptyAggregate();
    current.heartCount += articleMeta.heartCount || 0;
    current.viewCount += articleMeta.viewCount || 0;
    current.weightedInterestScore = current.heartCount * HEART_WEIGHT + current.viewCount;
    current.maxImportanceScore = Math.max(current.maxImportanceScore || 0, articleMeta.importanceScore || 0);
    current.articleCount += 1;
    if (!current.topic && row?.["주제"]) current.topic = clean(row["주제"]);
    map.set(normalizedKey, current);
  }

  function emptyAggregate() {
    return {
      heartCount: 0,
      viewCount: 0,
      weightedInterestScore: 0,
      maxImportanceScore: 0,
      articleCount: 0,
      topic: "",
    };
  }

  function compareNumber(a, b, multiplier) {
    return (Number(a || 0) - Number(b || 0)) * multiplier;
  }

  function compareDate(a, b, multiplier) {
    return ((a?.getTime?.() || 0) - (b?.getTime?.() || 0)) * multiplier;
  }

  function compareDateDesc(a, b) {
    return (b?.getTime?.() || 0) - (a?.getTime?.() || 0);
  }

  function compareText(a, b) {
    return clean(a).localeCompare(clean(b), "ko");
  }

  function getFirstPositiveNumber(row, columns) {
    for (const column of columns) {
      const value = parseNumber(row?.[column]);
      if (value > 0) return value;
    }
    return 0;
  }

  function parseNumber(value) {
    const match = clean(value).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : 0;
  }

  function parseCostValueSafe(value) {
    if (typeof window.parseCostValue === "function") return window.parseCostValue(value);
    if (isUnknownCostSafe(value)) return 0;
    const text = String(value || "").toLowerCase().replace(/,/g, "");
    const firstNumber = Number((text.match(/[0-9]+(?:\.[0-9]+)?/) || [0])[0]);
    if (!firstNumber) return 0;
    if (text.includes("billion") || text.includes("bn")) return firstNumber * 1_000_000_000;
    if (text.includes("million") || text.includes("mn") || text.includes("백만")) return firstNumber * 1_000_000;
    if (text.includes("억") && text.includes("달러")) return firstNumber * 100_000_000;
    if (text.includes("만") && text.includes("달러")) return firstNumber * 10_000;
    return firstNumber;
  }

  function isUnknownCostSafe(value) {
    if (typeof window.isUnknownCost === "function") return window.isUnknownCost(value);
    const text = clean(value).toLowerCase();
    return !text || /미확인|unknown|n\/a|-/.test(text);
  }

  function parseSheetDateSafe(value) {
    if (typeof window.parseSheetDate === "function") return window.parseSheetDate(value);
    const text = clean(value).replace(/^'+/, "").trim();
    const match = text.match(/(\d{4})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{1,2})/);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function formatDateSafe(date) {
    if (typeof window.formatDate === "function") return window.formatDate(date);
    if (!date || Number.isNaN(date.getTime())) return "";
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function clean(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }
})();
