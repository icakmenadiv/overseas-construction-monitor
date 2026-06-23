(() => {
  const SHEET_ID = "11WmfuDj7FSk5LRvEB2CArVETZOA9NgpySLYscG223-E";
  const RESULT_GID = "748239675";
  const PROJECT_GID = "20260612";
  const CACHE_PREFIX = "sheetCostCache:";
  const CACHE_TTL_MS = 10 * 60 * 1000;
  const MAX_CACHE_CHARS = 4_500_000;

  if (!window.fetch || !window.URLSearchParams || !window.sessionStorage) return;

  const originalFetch = window.fetch.bind(window);
  const getUrlText = (resource) => (typeof resource === "string" ? resource : resource?.url || "");
  const isSheetRequest = (url) =>
    url.includes("docs.google.com/spreadsheets") &&
    url.includes(`/d/${SHEET_ID}/`) &&
    url.includes("gviz/tq") &&
    url.includes("tqx=out:json");

  const pageName = () => window.location.pathname.split("/").pop() || "index.html";

  const escapeQueryValue = (value) => String(value || "").replace(/'/g, "\\'");

  const normalizeSheetUrl = (rawUrl) => {
    const url = new URL(rawUrl, window.location.href);
    const gid = url.searchParams.get("gid");
    const currentPage = pageName();

    if (currentPage === "projects.html" && gid === PROJECT_GID) {
      url.searchParams.set("range", "A1:M10000");
    }

    if (currentPage === "projects.html" && gid === RESULT_GID) {
      url.searchParams.set("range", "A:R");
      url.searchParams.set("tq", "select F,J where J is not null");
    }

    if (currentPage === "project.html" && gid === PROJECT_GID) {
      url.searchParams.set("range", "A:M");
      const params = new URLSearchParams(window.location.search);
      const projectId = params.get("id");
      const name = params.get("name");
      const country = params.get("country");
      const sector = params.get("sector");
      if (projectId) {
        url.searchParams.set("tq", `select * where A = '${escapeQueryValue(projectId)}'`);
      } else if (name) {
        const where = [
          `B = '${escapeQueryValue(name)}'`,
          country ? `D = '${escapeQueryValue(country)}'` : "",
          sector ? `E = '${escapeQueryValue(sector)}'` : "",
        ]
          .filter(Boolean)
          .join(" and ");
        url.searchParams.set("tq", `select * where ${where}`);
      }
    }

    if (currentPage === "project.html" && gid === RESULT_GID) {
      url.searchParams.set("range", "A:R");
      const params = new URLSearchParams(window.location.search);
      const projectId = params.get("id");
      const name = params.get("name");
      const country = params.get("country");
      const sector = params.get("sector");
      if (projectId) {
        url.searchParams.set("tq", `select * where H = '${escapeQueryValue(projectId)}'`);
      } else if (name) {
        const where = [
          `I = '${escapeQueryValue(name)}'`,
          country ? `D = '${escapeQueryValue(country)}'` : "",
          sector ? `E = '${escapeQueryValue(sector)}'` : "",
        ]
          .filter(Boolean)
          .join(" and ");
        url.searchParams.set("tq", `select * where ${where}`);
      }
    }

    url.searchParams.sort();
    return url.toString();
  };

  const makeResponse = (text, sourceUrl) =>
    new Response(text, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-Sheet-Cache": "hit",
        "X-Sheet-Source": sourceUrl,
      },
    });

  const readCache = (key) => {
    try {
      const cached = JSON.parse(sessionStorage.getItem(key) || "null");
      if (!cached || Date.now() - cached.time > CACHE_TTL_MS) return null;
      return cached.text;
    } catch (error) {
      return null;
    }
  };

  const writeCache = (key, text) => {
    if (!text || text.length > MAX_CACHE_CHARS) return;
    try {
      sessionStorage.setItem(key, JSON.stringify({ time: Date.now(), text }));
    } catch (error) {
      // Storage can be full or disabled; the page should still work without caching.
    }
  };

  window.fetch = async (resource, options) => {
    const rawUrl = getUrlText(resource);
    if (!rawUrl || !isSheetRequest(rawUrl)) return originalFetch(resource, options);

    const optimizedUrl = normalizeSheetUrl(rawUrl);
    const cacheKey = `${CACHE_PREFIX}${optimizedUrl}`;
    const cachedText = readCache(cacheKey);
    if (cachedText) return makeResponse(cachedText, optimizedUrl);

    const response = await originalFetch(optimizedUrl, options);
    if (!response.ok) return response;

    const text = await response.clone().text();
    writeCache(cacheKey, text);
    return makeResponse(text, optimizedUrl);
  };
})();
