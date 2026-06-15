(() => {
  const SHEET_ID = "11WmfuDj7FSk5LRvEB2CArVETZOA9NgpySLYscG223-E";
  const PROJECT_SHEET_GID = "20260612";
  const FETCH_TIMEOUT_MS = 7000;
  const JSONP_TIMEOUT_MS = 12000;

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
  const isProjectSheetRequest = (resource) => {
    const url = typeof resource === "string" ? resource : resource?.url || "";
    return (
      url.includes("docs.google.com/spreadsheets") &&
      url.includes(`/d/${SHEET_ID}/`) &&
      url.includes(`gid=${PROJECT_SHEET_GID}`) &&
      url.includes("headers=1") &&
      url.includes("tqx=out:json")
    );
  };

  const withTimeout = (promise, ms) =>
    Promise.race([
      promise,
      new Promise((_, reject) => window.setTimeout(() => reject(new Error("Project sheet request timeout")), ms)),
    ]);

  const makeSheetResponse = (text) =>
    new Response(text, {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });

  const validateGvizText = (text) => {
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}") + 1;
    if (jsonStart === -1 || jsonEnd === 0) throw new Error("Invalid project sheet GViz response");
    const data = JSON.parse(text.substring(jsonStart, jsonEnd));
    if (!data?.table?.cols || !data?.table?.rows) throw new Error("Project sheet GViz table missing");
    return text;
  };

  const fetchProjectSheetJsonp = () =>
    new Promise((resolve, reject) => {
      const callbackName = `__projectSheetPreload_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement("script");
      const cleanup = () => {
        delete window[callbackName];
        script.remove();
      };
      const timeoutId = window.setTimeout(() => {
        cleanup();
        reject(new Error("Project sheet JSONP timeout"));
      }, JSONP_TIMEOUT_MS);

      window[callbackName] = (data) => {
        window.clearTimeout(timeoutId);
        try {
          if (!data?.table?.cols || !data?.table?.rows) throw new Error("Project sheet JSONP table missing");
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
        reject(new Error("Project sheet JSONP load failed"));
      };
      script.src = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?gid=${PROJECT_SHEET_GID}&headers=1&tqx=out:json;responseHandler:${callbackName}`;
      document.head.appendChild(script);
    });

  window.fetch = async (resource, options) => {
    if (!isProjectSheetRequest(resource)) return originalFetch(resource, options);

    try {
      const response = await withTimeout(originalFetch(resource, options), FETCH_TIMEOUT_MS);
      if (!response.ok) throw new Error(`Project sheet HTTP ${response.status}`);
      const text = await withTimeout(response.clone().text(), FETCH_TIMEOUT_MS);
      return makeSheetResponse(validateGvizText(text));
    } catch (error) {
      console.warn("Project sheet fetch failed; using JSONP fallback", error);
      return fetchProjectSheetJsonp();
    }
  };
})();