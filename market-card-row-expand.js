(() => {
  function initCardRowExpand() {
    const grid = document.getElementById("topNewsCards");
    if (!grid || grid.dataset.rowExpandReady === "true") return;
    grid.dataset.rowExpandReady = "true";

    grid.addEventListener(
      "click",
      (event) => {
        const toggle = event.target.closest(".top-news-toggle");
        if (!toggle) return;
        const card = toggle.closest(".top-news-card");
        if (!card) return;

        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();

        const willExpand = !card.classList.contains("is-expanded");
        const rowCards = getSameRowCards(grid, card);
        rowCards.forEach((rowCard) => setCardExpanded(rowCard, willExpand));
      },
      true,
    );
  }

  function getSameRowCards(grid, targetCard) {
    const targetTop = Math.round(targetCard.offsetTop);
    return [...grid.querySelectorAll(".top-news-card")].filter(
      (card) => Math.abs(Math.round(card.offsetTop) - targetTop) <= 4,
    );
  }

  function setCardExpanded(card, expanded) {
    card.classList.toggle("is-expanded", expanded);
    const toggle = card.querySelector(".top-news-toggle");
    const detail = card.querySelector(".top-news-detail");
    if (toggle) toggle.setAttribute("aria-expanded", String(expanded));
    if (detail) detail.hidden = !expanded;
  }

  document.addEventListener("DOMContentLoaded", initCardRowExpand);
})();
