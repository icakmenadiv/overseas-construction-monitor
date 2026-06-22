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

  applyHeaderCopy();
  document.addEventListener("DOMContentLoaded", applyHeaderCopy);
  window.addEventListener("load", applyHeaderCopy);
  setTimeout(applyHeaderCopy, 300);
  setTimeout(applyHeaderCopy, 1000);
})();