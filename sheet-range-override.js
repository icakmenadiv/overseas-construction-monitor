(() => {
  if (typeof CONFIG === "undefined" || !CONFIG.SHEET_RANGES) return;

  CONFIG.SHEET_RANGES[CONFIG.PROJECT_SHEET_GID] = "A1:M10000";
  CONFIG.SHEET_RANGES[CONFIG.RESULT_SHEET_GID] = "A1:R50000";

  const RESULT_DETAIL_COLUMNS = [
    "원문게재일",
    "기사수집일",
    "지역",
    "국가",
    "섹터",
    "주제",
    "정보 분류",
    "프로젝트 고유값",
    "프로젝트명",
    "기사 고유값",
    "관련 단계",
    "제목(한글)",
    "제목(원문)",
    "내용",
    "중요도",
    "담당자 활용시 체크",
    "출처언어",
    "출처링크",
  ];

  const keyForProject = (row) => {
    const id = cleanValue(row["프로젝트 고유값"]);
    if (id) return `id:${id}`;
    return [row["프로젝트명"], row["국가"], row["섹터"]].map((value) => cleanValue(value).toLowerCase()).join("|");
  };

  const sortByLatestArticleDate = (a, b) => {
    const aDate = parseSheetDate(a["원문게재일"]) || parseSheetDate(a["기사수집일"]) || new Date(0);
    const bDate = parseSheetDate(b["원문게재일"]) || parseSheetDate(b["기사수집일"]) || new Date(0);
    return bDate.getTime() - aDate.getTime();
  };

  const buildProjectsFromResultRows = (resultRows) => {
    const grouped = new Map();

    resultRows.forEach((row) => {
      const projectName = cleanValue(row["프로젝트명"]);
      if (!projectName) return;
      const key = keyForProject(row);
      if (!key || key === "||") return;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(row);
    });

    return [...grouped.values()].map((rows) => {
      rows.sort(sortByLatestArticleDate);
      const latest = rows[0];
      const projectId = cleanValue(latest["프로젝트 고유값"]);
      const latestDate = cleanValue(latest["원문게재일"]) || cleanValue(latest["기사수집일"]);
      return {
        "프로젝트 고유값": projectId || keyForProject(latest),
        "프로젝트명": cleanValue(latest["프로젝트명"]),
        "지역": cleanValue(latest["지역"]),
        "국가": cleanValue(latest["국가"]),
        "섹터": cleanValue(latest["섹터"]),
        "발주처": "",
        "사업비(달러 기준 추정액)": "사업비 미확인",
        "사업비 환산 환율 / 기준": "",
        "현재 단계": cleanValue(latest["관련 단계"]) || "-",
        "최근 업데이트일": latestDate,
        "대표 기사 고유값": cleanValue(latest["기사 고유값"]),
        "비고": `운영시트 기사 ${rows.length}건 기준 자동 생성`,
        "대표 기사 정보 분류": cleanValue(latest["정보 분류"]) || "프로젝트 정보",
      };
    });
  };

  const mergeProjectRows = (masterRows, derivedRows) => {
    const merged = new Map();

    derivedRows.forEach((row) => merged.set(keyForProject(row), row));

    masterRows.forEach((row) => {
      const key = keyForProject(row);
      const existing = merged.get(key) || {};
      merged.set(key, {
        ...existing,
        ...row,
        "최근 업데이트일": row["최근 업데이트일"] || existing["최근 업데이트일"] || "",
        "대표 기사 고유값": row["대표 기사 고유값"] || existing["대표 기사 고유값"] || "",
        "현재 단계": row["현재 단계"] || existing["현재 단계"] || "-",
        "대표 기사 정보 분류": row["대표 기사 정보 분류"] || existing["대표 기사 정보 분류"] || "프로젝트 정보",
      });
    });

    return [...merged.values()];
  };

  loadProjects = async function loadProjectsWithOperatingSheetMerge() {
    try {
      if (els.refreshButton) els.refreshButton.disabled = true;
      if (els.syncStatus) els.syncStatus.textContent = "데이터 새로 고침 중...";

      const [masterRows, resultRows] = await Promise.all([
        fetchSheetData(CONFIG.PROJECT_SHEET_GID).then((rows) => normalizeRows(rows, PROJECT_COLUMNS)),
        fetchSheetData(CONFIG.RESULT_SHEET_GID).then((rows) => normalizeRows(rows, RESULT_DETAIL_COLUMNS)),
      ]);
      const representativeTopics = resultRows.reduce((map, row) => {
        const articleId = row["기사 고유값"];
        const topic = row["주제"];
        if (articleId && topic) map.set(articleId, topic);
        return map;
      }, new Map());
      const derivedProjectRows = buildProjectsFromResultRows(resultRows);

      state.projects = mergeProjectRows(masterRows, derivedProjectRows)
        .map((row) => normalizeProject(row, representativeTopics))
        .filter((project) => project.name && project.latestDateText);

      populateFilters();
      applyFilters();
      if (els.syncStatus) els.syncStatus.textContent = `마지막 불러오기 ${formatDateTime(new Date())}`;
    } catch (error) {
      console.error("Project monitoring fetch error:", error);
      showError();
    } finally {
      if (els.refreshButton) els.refreshButton.disabled = false;
    }
  };
})();
