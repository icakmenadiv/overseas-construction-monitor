// Anonymous interest-heart feature configuration.
//
// Production mode:
// - INTEREST_FEATURE_ENABLED true shows hearts on normal site URLs.
// - INTEREST_API_ENDPOINT stores and reads shared counts through Cloudflare Worker + D1.

window.INTEREST_FEATURE_ENABLED = true;
window.INTEREST_API_ENDPOINT = "https://icak-interest-api.icak-mena-div.workers.dev";

(() => {
  const params = new URLSearchParams(window.location.search);
  const previewEnabled = params.get("interest") === "1";
  const shouldPolish = Boolean(window.INTEREST_FEATURE_ENABLED) || previewEnabled;
  if (!shouldPolish) return;

  let runTimer = null;
  let observersInstalled = false;

  const run = () => {
    window.InterestFeature?.enhanceAll?.();
    polishMarketInterestColumn();
    syncTopNewsInterestCards();
  };

  const queueRun = (delay = 80) => {
    clearTimeout(runTimer);
    runTimer = setTimeout(run, delay);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", schedule);
  } else {
    schedule();
  }

  function schedule() {
    [80, 180, 420, 900, 1600, 2600].forEach((delay) => setTimeout(run, delay));
    installRenderObservers();
    document.addEventListener("click", () => {
      queueRun(40);
      setTimeout(run, 180);
      setTimeout(run, 520);
    });
    document.addEventListener("input", () => queueRun(120));
    document.addEventListener("change", () => queueRun(120));
  }

  function installRenderObservers() {
    if (observersInstalled) return;
    observersInstalled = true;

    const tryInstall = () => {
      const targets = [
        document.getElementById("resultBody"),
        document.getElementById("topNewsCards"),
        document.getElementById("projectArticles"),
        document.getElementById("projectContent"),
      ].filter(Boolean);

      if (!targets.length) {
        setTimeout(tryInstall, 250);
        return;
      }

      targets.forEach((target) => {
        new MutationObserver(() => queueRun(40)).observe(target, {
          childList: true,
          subtree: true,
        });
      });
    };

    tryInstall();
  }

  function polishMarketInterestColumn() {
    const table = document.querySelector(".market-table");
    const tbody = document.getElementById("resultBody");
    if (!table || !tbody) return;

    const headerRow = table.querySelector("thead tr");
    if (headerRow) {
      [...headerRow.children].forEach((cell) => {
        if (clean(cell.textContent) === "상세") cell.remove();
      });
      const interestHeader = headerRow.querySelector(".interest-header-cell");
      if (interestHeader) {
        interestHeader.textContent = "";
        interestHeader.setAttribute("aria-label", "관심");
      }
    }

    tbody.querySelectorAll("tr:not(.detail-row)").forEach((row) => {
      [...row.children].forEach((cell) => {
        if (cell.querySelector(".detail-button") || clean(cell.getAttribute("data-label")) === "상세") {
          cell.remove();
        }
      });
    });

    tbody.querySelectorAll("tr.detail-row > td").forEach((cell) => {
      if (headerRow) cell.colSpan = headerRow.children.length;
    });
  }

  function syncTopNewsInterestCards() {
    const cards = [...document.querySelectorAll("#topNewsCards .top-news-card")];
    if (!cards.length) return;

    cards.forEach((card) => {
      const matchedButton = findMatchingListHeart(card);
      if (!matchedButton) return;

      let wrap = card.querySelector(".top-news-interest");
      let button = wrap?.querySelector(".interest-button");
      const matchedId = matchedButton.dataset.articleId;

      if (!wrap) {
        wrap = document.createElement("div");
        wrap.className = "top-news-interest";
        card.appendChild(wrap);
      }

      if (!button || button.dataset.articleId !== matchedId || button.dataset.proxyReady !== "true") {
        wrap.innerHTML = "";
        button = matchedButton.cloneNode(true);
        button.disabled = matchedButton.disabled;
        button.dataset.proxyReady = "true";
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const currentMatch = findMatchingListHeart(card);
          if (currentMatch) currentMatch.click();
        });
        wrap.appendChild(button);
      }

      mirrorButtonState(matchedButton, button);
      card.dataset.interestReady = "true";
      card.dataset.articleId = matchedId;
    });
  }

  function findMatchingListHeart(card) {
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

  function mirrorButtonState(source, target) {
    target.dataset.articleId = source.dataset.articleId;
    target.dataset.articleTitle = source.dataset.articleTitle || target.dataset.articleTitle || "";
    target.dataset.articleUrl = source.dataset.articleUrl || target.dataset.articleUrl || "";
    target.classList.toggle("is-active", source.classList.contains("is-active"));
    target.classList.toggle("is-loading", source.classList.contains("is-loading"));
    target.setAttribute("aria-pressed", source.getAttribute("aria-pressed") || "false");
    const sourceHeart = source.querySelector(".interest-heart")?.textContent || "♡";
    const sourceCount = source.querySelector(".interest-count")?.textContent || "0";
    const targetHeart = target.querySelector(".interest-heart");
    const targetCount = target.querySelector(".interest-count");
    if (targetHeart) targetHeart.textContent = sourceHeart;
    if (targetCount) targetCount.textContent = sourceCount;
  }

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalize(value) {
    return clean(value).toLowerCase();
  }

  function normalizeUrl(value) {
    try {
      const url = new URL(value, window.location.href);
      url.hash = "";
      return `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}`.toLowerCase();
    } catch (error) {
      return normalize(value).replace(/\/$/, "");
    }
  }
})();
