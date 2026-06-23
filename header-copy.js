(() => {
  const applyHeaderCopy = () => {
    const eyebrow = document.querySelector(".brand-wrap .eyebrow");
    const title = document.querySelector(".brand-wrap h1");
    const subtitle = document.querySelector(".brand-wrap .subtitle");
    const navLinks = document.querySelectorAll(".page-nav a");

    if (eyebrow) eyebrow.textContent = "Market News";
    if (title) title.textContent = "해외 건설시장 뉴스";
    if (subtitle) subtitle.textContent = "주요 건설·인프라 시장뉴스를 필터로 확인합니다.";
    if (navLinks[0]) navLinks[0].textContent = "해외 건설시장 뉴스";
    if (navLinks[1]) navLinks[1].textContent = "프로젝트 목록";
  };

  const patchMarketProjectDetailLinks = () => {
    window.isProjectArticle = function isProjectArticlePatched(row) {
      return Boolean(
        row?.["프로젝트 고유값"] ||
          row?.["프로젝트명"] ||
          String(row?.["정보 분류"] || "").includes("프로젝트"),
      );
    };

    window.buildProjectDetailUrl = function buildProjectDetailUrlPatched(row) {
      const params = new URLSearchParams();
      if (row?.["프로젝트 고유값"]) params.set("id", row["프로젝트 고유값"]);
      if (row?.["프로젝트명"]) params.set("name", row["프로젝트명"]);
      if (row?.["국가"]) params.set("country", row["국가"]);
      if (row?.["섹터"]) params.set("sector", row["섹터"]);
      return `./project.html?${params.toString()}`;
    };
  };

  const applyAll = () => {
    applyHeaderCopy();
    patchMarketProjectDetailLinks();
  };

  applyAll();
  document.addEventListener("DOMContentLoaded", applyAll);
  window.addEventListener("load", applyAll);
  setTimeout(applyAll, 300);
  setTimeout(applyAll, 1000);
})();
