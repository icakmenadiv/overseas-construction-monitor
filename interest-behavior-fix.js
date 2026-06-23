(() => {
  const INTEREST_HELP_TEXT = "활용 가치가 높은 경우나 후속기사 추적을 원하는 경우 표시";
  let scheduled = false;

  document.addEventListener("DOMContentLoaded", schedule);
  if (document.readyState !== "loading") schedule();

  function schedule() {
    queueRun();
    observeDynamicAreas();
  }

  function queueRun() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      run();
    });
  }

  function run() {
    updateInterestCopy();
    syncProjectTotal();
    syncTopNewsProxyButtons();
  }

  function updateInterestCopy() {
    document.querySelectorAll(".interest-button").forEach((button) => {
      button.setAttribute("aria-label", INTEREST_HELP_TEXT);
      button.title = INTEREST_HELP_TEXT;
    });
    document.querySelectorAll(".interest-detail-box strong").forEach((strong) => {
      strong.textContent = INTEREST_HELP_TEXT;
    });
    document.querySelectorAll(".interest-note").forEach((note) => note.remove());
    document.querySelectorAll(".project-interest-label").forEach((label) => {
      label.textContent = "관심 합계";
    });
    document.querySelectorAll(".project-interest-caption").forEach((caption) => {
      caption.textContent = INTEREST_HELP_TEXT;
    });
  }

  function syncProjectTotal() {
    const totalEl = document.querySelector("[data-project-total-count]");
    if (!totalEl) return;
    const ids = new Set();
    let total = 0;
    document.querySelectorAll(".project-interest-box .interest-button, #projectArticles .project-article-interest .interest-button").forEach((button) => {
      const id = button.dataset.articleId;
      if (!id || ids.has(id)) return;
      ids.add(id);
      total += readButtonCount(button);
    });
    totalEl.textContent = numberFormat(total);
  }

  function syncTopNewsProxyButtons() {
    document.querySelectorAll("#topNewsCards .top-news-card").forEach((card) => {
      const listButton = findMatchingListButton(card);
      if (!listButton) return;

      let wrap = card.querySelector(".top-news-interest");
      if (!wrap) {
        wrap = document.createElement("div");
        wrap.className = "top-news-interest";
        card.appendChild(wrap);
      }

      let cardButton = wrap.querySelector(".interest-button");
      if (!cardButton || cardButton.dataset.articleId !== listButton.dataset.articleId || cardButton.dataset.proxyButton !== "true") {
        wrap.innerHTML = "";
        cardButton = listButton.cloneNode(true);
        cardButton.dataset.proxyButton = "true";
        cardButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const current = findMatchingListButton(card);
          if (current) current.click();
          queueRun();
        });
        wrap.appendChild(cardButton);
      }

      mirrorButton(listButton, cardButton);
      card.dataset.interestReady = "true";
      card.dataset.articleId = listButton.dataset.articleId;
    });
  }

  function findMatchingListButton(card) {
    const cardTitle = normalize(card.querySelector("h3")?.textContent);
    const cardUrl = normalizeUrl(card.querySelector("h3 a")?.getAttribute("href") || "");
    const rows = [...document.querySelectorAll("#resultBody tr:not(.detail-row)")];
    for (const row of rows) {
      const titleEl = row.querySelector(".market-title-cell .title-link") || row.querySelector(".market-title-cell a, .market-title-cell span");
      const rowTitle = normalize(titleEl?.textContent);
      const rowUrl = normalizeUrl(titleEl?.getAttribute("href") || "");
      const button = row.querySelector(".interest-button");
      if (!button) continue;
      if (cardUrl && rowUrl && cardUrl === rowUrl) return button;
      if (cardTitle && rowTitle && cardTitle === rowTitle) return button;
    }
    return null;
  }

  function mirrorButton(source, target) {
    target.dataset.articleId = source.dataset.articleId || "";
    target.dataset.articleTitle = source.dataset.articleTitle || "";
    target.dataset.articleUrl = source.dataset.articleUrl || "";
    target.className = source.className;
    target.dataset.proxyButton = "true";
    target.disabled = source.disabled;
    target.setAttribute("aria-pressed", source.getAttribute("aria-pressed") || "false");
    target.setAttribute("aria-label", INTEREST_HELP_TEXT);
    target.title = INTEREST_HELP_TEXT;
    const sourceHeart = source.querySelector(".interest-heart")?.textContent || "♡";
    const sourceCount = source.querySelector(".interest-count")?.textContent || "0";
    const targetHeart = target.querySelector(".interest-heart");
    const targetCount = target.querySelector(".interest-count");
    if (targetHeart) targetHeart.textContent = sourceHeart;
    if (targetCount) targetCount.textContent = sourceCount;
  }

  function observeDynamicAreas() {
    const install = () => {
      const targets = ["resultBody", "topNewsCards", "projectArticles", "projectContent"]
        .map((id) => document.getElementById(id))
        .filter(Boolean);
      if (!targets.length) {
        setTimeout(install, 300);
        return;
      }
      targets.forEach((target) => {
        if (target.dataset.interestBehaviorObserved === "true") return;
        target.dataset.interestBehaviorObserved = "true";
        new MutationObserver(queueRun).observe(target, { childList: true, subtree: true });
      });
    };
    install();
  }

  function readButtonCount(button) {
    const text = button.querySelector(".interest-count")?.textContent || "0";
    const value = Number(String(text).replace(/[^0-9.-]/g, ""));
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }

  function normalize(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function normalizeUrl(value) {
    try {
      const url = new URL(value, window.location.href);
      url.hash = "";
      ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"].forEach((key) => {
        url.searchParams.delete(key);
      });
      return `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}?${url.searchParams.toString()}`.toLowerCase();
    } catch (error) {
      return normalize(value).replace(/\/$/, "");
    }
  }

  function numberFormat(value) {
    return new Intl.NumberFormat("ko-KR").format(Number(value || 0));
  }
})();