(() => {
  const NAV_LABELS = ["해외 건설시장 뉴스", "프로젝트 목록"];

  function applyPolish() {
    normalizeNavigation();
    normalizeHeaderCopy();
    moveMarketTopNewsAboveListHeader();
    compactSummaryLabels();
    addHelpButtons();
    removeMinorExplanations();
  }

  function normalizeNavigation() {
    const links = document.querySelectorAll(".page-nav a");
    if (links[0]) links[0].textContent = NAV_LABELS[0];
    if (links[1]) links[1].textContent = NAV_LABELS[1];
  }

  function normalizeHeaderCopy() {
    const title = document.querySelector(".brand-wrap h1");
    const eyebrow = document.querySelector(".brand-wrap .eyebrow");
    const subtitle = document.querySelector(".brand-wrap .subtitle");
    const isProjectList = Boolean(document.getElementById("projectBody"));
    const isProjectDetail = Boolean(document.getElementById("projectTitle"));

    if (isProjectList) {
      document.title = "프로젝트 목록 | 해외 건설시장 모니터링";
      if (eyebrow) eyebrow.textContent = "Project List";
      if (title) title.textContent = "프로젝트 목록";
      if (subtitle) subtitle.textContent = "프로젝트별 관련 기사와 추진 단계 변화를 확인합니다.";
    } else if (isProjectDetail) {
      document.title = "프로젝트 상세 | 해외 건설시장 모니터링";
      if (eyebrow) eyebrow.textContent = "Project Detail";
      if (title) title.textContent = "프로젝트 상세";
      if (subtitle) subtitle.textContent = "프로젝트별 관련 기사와 최신 진행 단계를 확인합니다.";
    } else {
      document.title = "해외 건설시장 뉴스 | 해외 건설시장 모니터링";
      if (eyebrow) eyebrow.textContent = "Market News";
      if (title) title.textContent = "해외 건설시장 뉴스";
      if (subtitle) subtitle.textContent = "주요 건설·인프라 시장뉴스를 확인합니다.";
    }
  }

  function moveMarketTopNewsAboveListHeader() {
    const topNews = document.getElementById("topNewsSection");
    const results = document.querySelector(".market-results-section");
    const sectionHead = results?.querySelector(":scope > .section-head");
    if (!topNews || !results || !sectionHead) return;
    if (topNews.previousElementSibling !== sectionHead.previousElementSibling) {
      results.insertBefore(topNews, sectionHead);
    }
  }

  function compactSummaryLabels() {
    const labels = {
      "전체 기사 수": "전체 기사",
      "필터 적용 후": "검색 결과",
      "국가 수": "국가",
      "섹터 수": "섹터",
      "최근 원문게재일": "최근 기사",
      "전체 프로젝트 수": "프로젝트",
      "최근 업데이트": "최근 업데이트",
    };
    document.querySelectorAll(".summary-item span").forEach((span) => {
      const text = span.textContent.trim();
      if (labels[text]) span.textContent = labels[text];
    });
  }

  function addHelpButtons() {
    const helpTargets = [
      [document.querySelector(".market-results-section > .section-head h2"), "기사 클릭 시 상세가 열리고, 프로젝트 정보는 프로젝트 상세로 연결됩니다."],
      [document.querySelector(".results-section:not(.market-results-section) > .section-head h2"), "프로젝트명을 누르면 관련 기사 상세 목록을 확인할 수 있습니다."],
      [document.querySelector(".project-title-block h2"), "프로젝트 고유값을 우선으로 관련 기사를 연결하고, 필요 시 프로젝트명·국가·섹터로 보조 매칭합니다."],
      [document.querySelector(".top-news-title-inline"), "중요도 수치값 기준으로 선별된 주요 기사입니다."],
    ];

    helpTargets.forEach(([target, label]) => {
      if (!target || target.querySelector(".inline-help")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "inline-help";
      button.textContent = "?";
      button.setAttribute("aria-label", label);
      target.appendChild(document.createTextNode(" "));
      target.appendChild(button);
    });
  }

  function removeMinorExplanations() {
    document.querySelectorAll(".section-head p, .ai-notice, .limit-notice").forEach((element) => {
      element.hidden = true;
    });
    const sync = document.getElementById("syncStatus");
    if (sync) sync.textContent = "";
  }

  document.addEventListener("DOMContentLoaded", () => {
    applyPolish();
    window.setTimeout(applyPolish, 300);
    window.setTimeout(applyPolish, 900);
  });
})();
