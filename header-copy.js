document.addEventListener("DOMContentLoaded", () => {
  const eyebrow = document.querySelector(".brand-wrap .eyebrow");
  const title = document.querySelector(".brand-wrap h1");
  const subtitle = document.querySelector(".brand-wrap .subtitle");

  if (eyebrow) eyebrow.textContent = "통합 모니터링";
  if (title) title.textContent = "해외 건설시장 모니터링";
  if (subtitle) subtitle.textContent = "글로벌 건설·인프라 동향 및 프로젝트 정보를 한눈에";
});
