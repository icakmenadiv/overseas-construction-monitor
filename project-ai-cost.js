(() => {
  const AI_PROJECT_RANGE = "A1:U20000";
  const AI_PROJECT_COLUMNS = [
    "사업비 확인상태",
    "AI추정사업비",
    "AI 추정 신뢰도",
    "AI 추정근거",
    "AI 규모 노출등급",
  ];

  if (typeof CONFIG === "object") CONFIG.PROJECT_RANGE = AI_PROJECT_RANGE;
  if (Array.isArray(PROJECT_COLUMNS)) {
    AI_PROJECT_COLUMNS.forEach((column) => {
      if (!PROJECT_COLUMNS.includes(column)) PROJECT_COLUMNS.push(column);
    });
  }

  try {
    const originalFetchRowsWithSheetFallback = fetchRowsWithSheetFallback;
    fetchRowsWithSheetFallback = async function fetchRowsWithAiCostFallback(path, gid, range, bustCache = false) {
      const rows = await originalFetchRowsWithSheetFallback(path, gid, range, bustCache);
      if (path === CONFIG.PROJECT_DATA_URL && !rowsIncludeAiColumns(rows)) {
        console.warn("Project cache does not include AI cost columns; reading source sheet range A:U.");
        return fetchSheetRows(gid, AI_PROJECT_RANGE);
      }
      return rows;
    };
  } catch (error) {
    console.warn("AI cost data fallback could not be installed.", error);
  }

  const originalSortProjects = typeof sortProjects === "function" ? sortProjects : null;

  function rowsIncludeAiColumns(payload) {
    const rows = Array.isArray(payload) ? payload : payload?.rows || payload?.projects || [];
    if (!rows.length) return false;
    return rows.some((row) => AI_PROJECT_COLUMNS.some((column) => Object.prototype.hasOwnProperty.call(row, column)));
  }

  function normalizeProjectWithAiCost(row, representativeMeta = new Map()) {
    const officialCostText = clean(row["사업비(달러 기준 추정액)"] || "");
    const officialCostValue = parseCostValueForAi(officialCostText);
    const officialCostKnown = officialCostValue > 0 && !isUnknownCostForAi(officialCostText);
    const aiCostText = clean(row["AI추정사업비"] || "");
    const aiCostValue = parseCostValueForAi(aiCostText);
    const hasAiEstimate = !officialCostKnown && aiCostValue > 0;
    const costText = officialCostKnown ? officialCostText : hasAiEstimate ? aiCostText : "사업비 미확인";
    const costValue = officialCostKnown ? officialCostValue : hasAiEstimate ? aiCostValue : 0;
    const latestDate = parseSheetDateSafe(row["최근 업데이트일"]);
    const latestDateText = formatDateSafe(latestDate) || row["최근 업데이트일"];
    const representativeArticleId = row["대표 기사 고유값"] || row["관련 기사 고유값 1"];
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
      costKnown: officialCostKnown || hasAiEstimate,
      officialCostText,
      officialCostValue,
      officialCostKnown,
      aiCostText,
      aiCostValue,
      hasAiEstimate,
      aiConfidence: row["AI 추정 신뢰도"],
      aiBasis: row["AI 추정근거"],
      aiExposureClass: row["AI 규모 노출등급"],
      costSource: hasAiEstimate ? "ai" : officialCostKnown ? "official" : "unknown",
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
  }

  function applyFiltersWithAiCost() {
    const keyword = (els.keywordInput?.value || "").trim().toLowerCase();
    const regions = getCheckedValues(els.regionFilter);
    const countries = getCheckedValues(els.countryFilter);
    const sectors = getCheckedValues(els.sectorFilter);
    const stages = getCheckedValues(els.stageFilter);
    const excludeSmallCost = Boolean(els.includeSmallCost?.checked);

    let projects = state.projects.filter((project) => {
      const keywordOk =
        !keyword ||
        [
          project.projectId,
          project.name,
          project.owner,
          project.representativeArticleId,
          project.representativeTopic,
          project.note,
          project.region,
          project.country,
          project.sector,
          project.stage,
          project.costText,
          project.aiCostText,
          project.aiConfidence,
          project.aiExposureClass,
        ]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      const regionOk = !regions.length || regions.includes(project.region);
      const countryOk = !countries.length || countries.includes(project.country);
      const sectorOk = !sectors.length || sectors.includes(project.sector);
      const stageOk = !stages.length || stages.includes(project.stage);
      const smallCostOk = !excludeSmallCost || !isSmallCostWithAiToggle(project);
      return keywordOk && regionOk && countryOk && sectorOk && stageOk && smallCostOk;
    });

    projects = sortProjects(projects, els.sortSelect?.value || "cost:desc");
    state.filteredProjects = projects;
    updateSummary();
    renderFeaturedProjects();
    renderProjects();
    updateActiveFilterTextWithAiCost();
  }

  function sortProjectsWithAiCost(projects, sortValue) {
    const [key, direction] = String(sortValue || "cost:desc").split(":");
    const multiplier = direction === "desc" ? -1 : 1;
    if (key !== "cost" && originalSortProjects) return originalSortProjects(projects, sortValue);
    return [...projects].sort((a, b) => (getActiveCostValue(a) - getActiveCostValue(b)) * multiplier || clean(a.name).localeCompare(clean(b.name), "ko"));
  }

  function renderFeaturedProjectsWithAiCost() {
    if (!els.featuredProjects) return;
    const featured = [...state.filteredProjects]
      .filter((project) => getActiveCostValue(project) > 0)
      .sort((a, b) => getActiveCostValue(b) - getActiveCostValue(a))
      .slice(0, 3);
    els.featuredProjects.hidden = featured.length === 0;
    if (!featured.length) {
      els.featuredProjects.innerHTML = "";
      return;
    }
    els.featuredProjects.innerHTML = `
      <div class="featured-projects-head">
        <div>
          <span>대표 프로젝트</span>
          <h2>사업비 규모 기준 상위 3건</h2>
        </div>
        <p>현재 필터 결과에서 공식 사업비와 선택 시 AI 추정사업비를 함께 기준으로 표시합니다.</p>
      </div>
      <div class="featured-project-card-grid">${featured.map(renderFeaturedProjectCard).join("")}</div>`;
  }

  function updateActiveFilterTextWithAiCost() {
    const filters = [];
    if (els.keywordInput?.value?.trim()) filters.push(`검색: ${els.keywordInput.value.trim()}`);
    pushSelectedFilter(filters, "지역", getCheckedValues(els.regionFilter));
    pushSelectedFilter(filters, "국가", getCheckedValues(els.countryFilter));
    pushSelectedFilter(filters, "섹터", getCheckedValues(els.sectorFilter));
    pushSelectedFilter(filters, "단계", getCheckedValues(els.stageFilter));
    filters.push(els.includeSmallCost?.checked ? "1천만불 이하 제외" : "1천만불 이하 포함");
    filters.push(isAiEstimateIncluded() ? "AI 추정 사업비 포함" : "공식 사업비만 표시");
    els.activeFilterText.textContent = filters.join(" · ");
  }

  function formatCostWithAiCost(project) {
    const activeValue = getActiveCostValue(project);
    if (!activeValue) return "사업비 미확인";
    const amount =
      activeValue >= CONFIG.HUNDRED_MILLION_USD
        ? `${formatCompactAmount(activeValue / CONFIG.HUNDRED_MILLION_USD)}억불`
        : `${formatCompactAmount(activeValue / CONFIG.MILLION_USD)}백만불`;
    return project.hasAiEstimate && !project.officialCostKnown && isAiEstimateIncluded() ? `${amount} (AI 추정)` : amount;
  }

  function getActiveCostValue(project) {
    if (project.officialCostKnown) return project.officialCostValue || project.costValue || 0;
    if (isAiEstimateIncluded() && project.hasAiEstimate) return project.aiCostValue || project.costValue || 0;
    return 0;
  }

  function isSmallCostWithAiToggle(project) {
    const activeValue = getActiveCostValue(project);
    return activeValue > 0 && activeValue <= CONFIG.SMALL_COST_THRESHOLD_USD;
  }

  function isAiEstimateIncluded() {
    return Boolean(document.getElementById("includeAiEstimate")?.checked ?? true);
  }

  function parseCostValueForAi(value) {
    if (isUnknownCostForAi(value)) return 0;
    const text = clean(value)
      .toLowerCase()
      .replace(/,/g, "")
      .replace(/\([^)]*\)/g, " ");
    const candidates = [];
    collectCostCandidates(text, /([0-9]+(?:\.[0-9]+)?)\s*(?:billion|bn)\b/g, 1_000_000_000, candidates);
    collectCostCandidates(text, /([0-9]+(?:\.[0-9]+)?)\s*(?:million|mn|m)\b/g, 1_000_000, candidates);
    collectCostCandidates(text, /([0-9]+(?:\.[0-9]+)?)\s*백만\s*(?:달러|불|usd)?/g, 1_000_000, candidates);
    collectCostCandidates(text, /([0-9]+(?:\.[0-9]+)?)\s*억\s*(?:달러|불|usd)?/g, 100_000_000, candidates);
    collectCostCandidates(text, /([0-9]+(?:\.[0-9]+)?)\s*만\s*(?:달러|불|usd)/g, 10_000, candidates);
    if (candidates.length) return Math.max(...candidates);

    const literalDollarMatch =
      text.match(/(?:usd|us\$|달러|불)\s*([0-9]+(?:\.[0-9]+)?)/) ||
      text.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:usd|us\$|달러|불)/);
    return literalDollarMatch ? Number(literalDollarMatch[1]) : 0;
  }

  function collectCostCandidates(text, regex, multiplier, candidates) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      const amount = Number(match[1]);
      if (Number.isFinite(amount) && amount > 0) candidates.push(amount * multiplier);
    }
  }

  function isUnknownCostForAi(value) {
    const text = clean(value).toLowerCase();
    return !text || /사업비\s*미확인|미공개|환산\s*미공개|unknown|n\/a|tbd|not\s+disclosed/.test(text);
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

  function clean(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  window.normalizeProject = normalizeProjectWithAiCost;
  window.applyProjectFilters = applyFiltersWithAiCost;
  window.renderFeaturedProjects = renderFeaturedProjectsWithAiCost;
  window.formatCost = formatCostWithAiCost;
  window.sortProjects = sortProjectsWithAiCost;

  try {
    normalizeProject = normalizeProjectWithAiCost;
    applyFilters = applyFiltersWithAiCost;
    renderFeaturedProjects = renderFeaturedProjectsWithAiCost;
    formatCost = formatCostWithAiCost;
    sortProjects = sortProjectsWithAiCost;
  } catch (error) {
    console.warn("AI cost override could not rebind every project function.", error);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const aiToggle = document.getElementById("includeAiEstimate");
    if (aiToggle) aiToggle.addEventListener("change", applyFiltersWithAiCost);
    document.querySelectorAll("#resetButton, [data-reset-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        setTimeout(() => {
          if (aiToggle) aiToggle.checked = true;
          applyFiltersWithAiCost();
        }, 0);
      });
    });
  });
})();
