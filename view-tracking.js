(() => {
  const TRACKING_ENDPOINT = getTrackingEndpoint();
  const SESSION_KEY = "icakViewSessionId";
  const BROWSER_KEY = "icakViewBrowserId";
  const DEDUPE_KEY = "icakViewEventDedupe";
  const MARKET_DEDUPE_KEY = "icakViewMarketVisitDedupe";
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
      if (projectId) track("project_detail_open", projectId, { targetType: "project", sourceUrl: url.toString() });
      return;
    }

    if (!isSourceLink(url, link)) return;
    const articleId = findArticleId(link);
    if (articleId) track("source_link_click", articleId, { targetType: "article", sourceUrl: url.toString() });
  }

  function scheduleArticleDetailTrack(articleId, trigger) {
    if (!articleId) return;
    setTimeout(() => {
      if (isExpanded(trigger, articleId)) track("article_detail_open", articleId, { targetType: "article" });
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
    if (!TRACKING_ENDPOINT || !targetId) return;
    const sessionId = getSessionId();
    const browserId = getBrowserId();
    if (shouldDedupe(eventType, targetId, { sessionId, browserId })) return;
    const payload = {
      event_type: eventType,
      target_type: options.targetType || inferTargetType(eventType),
      target_id: String(targetId),
      session_id: sessionId,
      browser_id: browserId,
      source_url: options.sourceUrl || "",
      page_path: `${window.location.pathname}${window.location.search}`,
      event_date_kst: getKstDateKey(),
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
    track("market_page_visit", "market-home", { targetType: "market" });
  }

  function trackProjectPageOpen() {
    if (!/project\.html$/i.test(window.location.pathname)) return;
    const projectId = getProjectIdFromUrl(new URL(window.location.href));
    if (projectId) track("project_detail_open", projectId, { targetType: "project" });
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

  function shouldDedupe(eventType, targetId, ids) {
    if (eventType === "market_page_visit") {
      return shouldDedupeMarketVisit(eventType, targetId, ids.browserId);
    }
    return shouldDedupeRecentEvent(eventType, targetId, ids.sessionId);
  }

  function shouldDedupeMarketVisit(eventType, targetId, browserId) {
    const dateKey = getKstDateKey();
    const dedupeKey = `${eventType}|${targetId}|${browserId}|${dateKey}`;
    const cache = readJson(MARKET_DEDUPE_KEY, {}, localStorage);
    if (cache[dedupeKey]) return true;
    cache[dedupeKey] = Date.now();
    Object.keys(cache).forEach((itemKey) => {
      if (!itemKey.endsWith(`|${dateKey}`)) delete cache[itemKey];
    });
    writeJson(MARKET_DEDUPE_KEY, cache, localStorage);
    return false;
  }

  function shouldDedupeRecentEvent(eventType, targetId, sessionId) {
    const now = Date.now();
    const key = `${eventType}|${targetId}|${sessionId}`;
    const cache = readJson(DEDUPE_KEY, {}, sessionStorage);
    const last = Number(cache[key] || 0);
    if (last && now - last < DEDUPE_WINDOW_MS) return true;
    cache[key] = now;
    Object.keys(cache).forEach((itemKey) => {
      if (now - Number(cache[itemKey] || 0) > 24 * 60 * 60 * 1000) delete cache[itemKey];
    });
    writeJson(DEDUPE_KEY, cache, sessionStorage);
    return false;
  }

  function getSessionId() {
    return getStoredId(sessionStorage, SESSION_KEY, "session-unavailable");
  }

  function getBrowserId() {
    return getStoredId(localStorage, BROWSER_KEY, "browser-unavailable");
  }

  function getStoredId(storage, key, fallback) {
    try {
      let id = storage.getItem(key);
      if (!id) {
        id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        storage.setItem(key, id);
      }
      return id;
    } catch (error) {
      return fallback;
    }
  }

  function inferTargetType(eventType) {
    if (eventType === "project_detail_open") return "project";
    if (eventType === "market_page_visit") return "market";
    return "article";
  }

  function getKstDateKey() {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(new Date());
  }

  function getTrackingEndpoint() {
    const configured = window.VIEW_TRACKING_ENDPOINT || document.querySelector('meta[name="view-tracking-endpoint"]')?.content || "";
    if (!configured) return "";
    const url = new URL(configured, window.location.href);
    if (url.pathname === "/" || !url.pathname) url.pathname = "/track";
    return url.toString();
  }

  function readJson(key, fallback, storage = sessionStorage) {
    try {
      return JSON.parse(storage.getItem(key) || JSON.stringify(fallback));
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value, storage = sessionStorage) {
    try {
      storage.setItem(key, JSON.stringify(value));
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
