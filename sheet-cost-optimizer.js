(() => {
  const SHEET_ID = "11WmfuDj7FSk5LRvEB2CArVETZOA9NgpySLYscG223-E";
  const RESULT_GID = "748239675";
  const PROJECT_GID = "20260612";
  const CACHE_URLS = {
    [RESULT_GID]: "./data/articles.json",
    [PROJECT_GID]: "./data/projects.json",
  };

  const memoryCache = new Map();
  const originalFetch = window.fetch?.bind(window);
  if (!originalFetch) return;

  window.fetch = async (resource, options) => {
    const urlText = getUrlText(resource);
    const gid = getSheetGid(urlText);
    if (!gid) return originalFetch(resource, options);

    try {
      const rows = await loadCachedRows(gid);
      return makeGvizResponse(rows);
    } catch (error) {
      console.warn("Static sheet cache failed; falling back to Google Sheets", error);
      return originalFetch(resource, options);
    }
  };

  function getUrlText(resource) {
    return typeof resource === "string" ? resource : resource?.url || "";
  }

  function getSheetGid(urlText) {
    if (!urlText || !urlText.includes("docs.google.com/spreadsheets")) return "";
    if (!urlText.includes(`/d/${SHEET_ID}/`) || !urlText.includes("gviz/tq")) return "";
    if (urlText.includes(`gid=${RESULT_GID}`)) return RESULT_GID;
    if (urlText.includes(`gid=${PROJECT_GID}`)) return PROJECT_GID;
    return "";
  }

  async function loadCachedRows(gid) {
    const cacheUrl = CACHE_URLS[gid];
    if (!cacheUrl) throw new Error(`Unsupported sheet gid: ${gid}`);
    if (memoryCache.has(cacheUrl)) return memoryCache.get(cacheUrl);

    const response = await originalFetch(cacheUrl, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Cache HTTP ${response.status}: ${cacheUrl}`);
    const payload = await response.json();
    const rows = Array.isArray(payload) ? payload : payload?.articles || payload?.projects || [];
    if (!rows.length) throw new Error(`Static cache is empty: ${cacheUrl}`);
    memoryCache.set(cacheUrl, rows);
    return rows;
  }

  function makeGvizResponse(rows) {
    const columns = collectColumns(rows);
    const table = {
      cols: columns.map((label) => ({ id: label, label, type: "string" })),
      rows: rows.map((row) => ({
        c: columns.map((column) => {
          const value = row[column] ?? "";
          return value === "" ? null : { v: String(value), f: String(value) };
        }),
      })),
    };
    const text = `/*O_o*/\ngoogle.visualization.Query.setResponse(${JSON.stringify({ version: "0.6", status: "ok", table })});`;
    return new Response(text, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-Static-Sheet-Cache": "hit",
      },
    });
  }

  function collectColumns(rows) {
    const columns = [];
    const seen = new Set();
    rows.forEach((row) => {
      Object.keys(row || {}).forEach((key) => {
        if (seen.has(key)) return;
        seen.add(key);
        columns.push(key);
      });
    });
    return columns;
  }
})();