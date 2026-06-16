(() => {
  const originalBuildArticleItems = window.buildArticleItems;
  if (typeof originalBuildArticleItems !== "function") return;

  const cleanValue = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

  window.buildArticleItems = (project, resultRows = []) => {
    const items = originalBuildArticleItems(project, resultRows);
    if (items.length || !cleanValue(project["대표 기사 고유값"])) return items;

    const date = cleanValue(project["최근 업데이트일"]);
    const stage = cleanValue(project["현재 단계"]);
    const projectName = cleanValue(project["프로젝트명"]);
    const note = cleanValue(project["비고"]);

    return [
      {
        mapping: {
          "기사 고유값": cleanValue(project["대표 기사 고유값"]),
          "기사일자": date,
          "기사 시점 단계": stage,
          "해당 기사 기준 사업비": cleanValue(project["사업비(달러 기준 추정액)"]),
          "대표기사 여부": "Y",
        },
        article: {
          "원문게재일": date,
          "프로젝트 고유값": cleanValue(project["프로젝트 고유값"]),
          "프로젝트명": projectName,
          "기사 고유값": cleanValue(project["대표 기사 고유값"]),
          "관련 단계": stage,
          "제목(한글)": `${projectName || "프로젝트"} 대표기사 정보`,
          "제목(원문)": "",
          "내용": note || "프로젝트 탭 대표 기사 고유값은 있으나 결과 탭의 원문 기사 행이 연결되지 않은 상태임. 운영 시트 점검 후 결과 탭 기사 행 복구가 필요함.",
          "출처언어": "",
          "출처링크": "",
        },
      },
    ];
  };
})();
