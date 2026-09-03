(() => {
  const SHEET_ID = "11WmfuDj7FSk5LRvEB2CArVETZOA9NgpySLYscG223-E";
  const PROJECT_SHEET_GID = "20260612";
  const PROJECT_SHEET_RANGE = "A1:M10000";
  const FETCH_TIMEOUT_MS = 10000;

  if (typeof window.debounce !== "function") {
    window.debounce = function (fn, delay) {
      let timeoutId;
      return function (...args) {
        window.clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => fn.apply(this, args), delay);
      };
    };
  }

  if (!window.fetch) return;

  const originalFetch = window.fetch.bind(window);
  const getUrlText = (resource) => (typeof resource === "string" ? resource : resource?.url || "");
  const isProjectSheetRequest = (resource) => {
    const url = getUrlText(resource);
    return (
      url.includes("docs.google.com/spreadsheets") &&
      url.includes(`/d/${SHEET_ID}/`) &&
      url.includes(`gid=${PROJECT_SHEET_GID}`) &&
      url.includes("headers=1") &&
      url.includes("tqx=out:json")
    );
  };

  const withRange = (resource) => {
    const url = new URL(getUrlText(resource));
    url.searchParams.set("range", PROJECT_SHEET_RANGE);
    return url.toString();
  };

  const withTimeout = (promise, ms) =>
    Promise.race([
      promise,
      new Promise((_, reject) => window.setTimeout(() => reject(new Error("Projects preview sheet request timeout")), ms)),
    ]);

  const makeSheetResponse = (text) =>
    new Response(text, {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });

  const parseGviz = (text) => {
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}") + 1;
    if (jsonStart === -1 || jsonEnd === 0) throw new Error("Invalid projects preview GViz response");
    const data = JSON.parse(text.substring(jsonStart, jsonEnd));
    if (!data?.table?.cols || !data?.table?.rows) throw new Error("Projects preview GViz table missing");
    return data;
  };

  const fetchJsonp = () =>
    new Promise((resolve, reject) => {
      const callbackName = `__projectsPreview_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement("script");
      const cleanup = () => {
        delete window[callbackName];
        script.remove();
      };
      const timeoutId = window.setTimeout(() => {
        cleanup();
        reject(new Error("Projects preview JSONP timeout"));
      }, FETCH_TIMEOUT_MS);

      window[callbackName] = (data) => {
        window.clearTimeout(timeoutId);
        try {
          if (!data?.table?.cols || !data?.table?.rows) throw new Error("Projects preview JSONP table missing");
          resolve(makeSheetResponse(JSON.stringify(data)));
        } catch (error) {
          reject(error);
        } finally {
          cleanup();
        }
      };

      script.onerror = () => {
        window.clearTimeout(timeoutId);
        cleanup();
        reject(new Error("Projects preview JSONP load failed"));
      };
      script.src = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?gid=${PROJECT_SHEET_GID}&headers=1&range=${encodeURIComponent(PROJECT_SHEET_RANGE)}&tqx=out:json;responseHandler:${callbackName}`;
      document.head.appendChild(script);
    });

  window.fetch = async (resource, options) => {
    if (!isProjectSheetRequest(resource)) return originalFetch(resource, options);

    try {
      const response = await withTimeout(originalFetch(withRange(resource), options), FETCH_TIMEOUT_MS);
      if (!response.ok) throw new Error(`Projects preview sheet HTTP ${response.status}`);
      const text = await withTimeout(response.clone().text(), FETCH_TIMEOUT_MS);
      parseGviz(text);
      return makeSheetResponse(text);
    } catch (error) {
      console.warn("Projects preview range fetch failed; using JSONP fallback", error);
      return fetchJsonp();
    }
  };
})();
