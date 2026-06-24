(() => {
  const TRACKING_ENDPOINT = getTrackingEndpoint();
  const SESSION_KEY = "icakViewSessionId";
  const DEDUPE_KEY = "icakViewEventDedupe";
  const DEDUPE_WINDOW_MS = 5 * 60 * 1000;

  window.ViewTracking = {
    enabled: Boolean(TRACKING_ENDPOINT),
    track,
    getCounts,
  };

  document.addEventListener("DOMContentLoaded", () => {
    loadCountCache();
    trackMarketPageVisit();
    trackProjectPageOpen();
  });

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (link) {
      handleLinkClick(link);
      return;
    }

    const detailButton = event.target.closest(".detail-button");
    if (detailButton) {
      const row = detailButton.closest("tr[data-article-id]");
      scheduleArticleDetailTrack(row?.dataset.articleId, detailButton);
      return;
    }

    const topNewsCard = event.target.closest("#topNewsCards .top-news-card");
    if (topNewsCard) {
      scheduleArticleDetailTrack(topNewsCard.dataset.articleId, topNewsCard);
      return;
    }

    const row = event.target.closest("tr[data-article-id]");
    if (row && !event.target.closest("button, a")) {
      scheduleArticleDetailTrack(row.dataset.articleId, row);
    }
  });

  function handleLinkClick(link) {
    const href = link.getAttribute("href") || "";
    const url = new URL(href, window.location.href);

    if (isProjectDetailLink(url, link)) {
      const projectId = getProjectIdFromUrl(url);
      if (projectId) track("project_detail_open", projectId, { sourceUrl: url.toString() });
      return;
    }

    if (!isSourceLink(url, link)) return;
    const articleId = findArticleId(link);
    if (articleId) track("source_link_click", articleId, { sourceUrl: url.toString() });
  }

  function scheduleArticleDetailTrack(articleId, trigger) {
    if (!articleId) return;
    setTimeout(() => {
      if (isExpanded(trigger, articleId)) track("article_detail_open", articleId);
    }, 0);
  }

  function isExpanded(trigger, articleId) {
    if (!trigger) return false;
    if (trigger.matches?.(".top-news-card")) return trigger.getAttribute("aria-expanded") === "true";
    const row = trigger.closest?.("tr[data-article-id]") || trigger;
    const button = row.querySelector?.(".detail-button");
    if (button?.getAttribute("aria-expanded") === "true") return true;
    return Boolean(document.querySelector(`tr.detail-row[data-detail-for="${cssEscape(articleId)}"]`));
  }

  function track(eventType, targetId, options = {}) {
    if (!TRACKING_ENDPOINT || !targetId || shouldDedupe(eventType, targetId)) return;
    const payload = {
      event_type: eventType,
      target_id: String(targetId),
      session_id: getSessionId(),
      source_url: options.sourceUrl || "",
      page_path: `${window.location.pathname}${window.location.search}`,
    };
    sendPayload(payload);
  }

  function sendPayload(payload) {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(TRACKING_ENDPOINT, blob)) return;
    }
    fetch(TRACKING_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  }

  async function loadCountCache() {
    try {
      const response = await fetch("./data/view-counts.json", { cache: "no-cache" });
      if (!response.ok) return;
      window.ViewCounts = await response.json();
    } catch (error) {
      window.ViewCounts = { counts: {}, rows: [] };
    }
  }

  function getCounts(targetType, targetId) {
    return window.ViewCounts?.counts?.[targetType]?.[targetId] || {};
  }

  function trackMarketPageVisit() {
    if (!isMarketPage()) return;
    track("market_page_visit", "market-home");
  }

  function trackProjectPageOpen() {
    if (!/project\.html$/i.test(window.location.pathname)) return;
    const projectId = getProjectIdFromUrl(new URL(window.location.href));
    if (projectId) track("project_detail_open", projectId);
  }

  function isMarketPage() {
    const path = window.location.pathname.replace(/\/+$/, "");
    return path === "" || path === "/" || /\/index\.html$/i.test(window.location.pathname);
  }

  function isProjectDetailLink(url, link) {
    return link.classList.contains("project-detail-link") || /project\.html$/i.test(url.pathname);
  }

  function isSourceLink(url, link) {
    if (url.origin === window.location.origin && /\.html$/i.test(url.pathname)) return false;
    if (link.closest(".page-nav, .brand, .project-back-link")) return false;
    return Boolean(findArticleId(link));
  }

  function findArticleId(node) {
    const articleNode = node.closest("[data-article-id]");
    if (articleNode?.dataset.articleId) return articleNode.dataset.articleId;
    const detailRow = node.closest("tr.detail-row[data-detail-for]");
    if (detailRow) {
      const row = detailRow.previousElementSibling;
      if (row?.dataset.articleId) return row.dataset.articleId;
    }
    return "";
  }

  function getProjectIdFromUrl(url) {
    return clean(url.searchParams.get("id")) || clean(url.searchParams.get("name"));
  }

  function shouldDedupe(eventType, targetId) {
    const now = Date.now();
    const key = `${eventType}|${targetId}|${getSessionId()}`;
    const cache = readJson(DEDUPE_KEY, {});
    const last = Number(cache[key] || 0);
    if (last && now - last < DEDUPE_WINDOW_MS) return true;
    cache[key] = now;
    Object.keys(cache).forEach((itemKey) => {
      if (now - Number(cache[itemKey] || 0) > 24 * 60 * 60 * 1000) delete cache[itemKey];
    });
    writeJson(DEDUPE_KEY, cache);
    return false;
  }

  function getSessionId() {
    try {
      let id = sessionStorage.getItem(SESSION_KEY);
      if (!id) {
        id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        sessionStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch (error) {
      return "session-unavailable";
    }
  }

  function getTrackingEndpoint() {
    const configured = window.VIEW_TRACKING_ENDPOINT || document.querySelector('meta[name="view-tracking-endpoint"]')?.content || "";
    if (!configured) return "";
    const url = new URL(configured, window.location.href);
    if (url.pathname === "/" || !url.pathname) url.pathname = "/track";
    return url.toString();
  }

  function readJson(key, fallback) {
    try {
      return JSON.parse(sessionStorage.getItem(key) || JSON.stringify(fallback));
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {}
  }

  function clean(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function cssEscape(value) {
    if (window.CSS?.escape) return CSS.escape(value);
    return String(value).replace(/["\\]/g, "\\$&");
  }
})();
