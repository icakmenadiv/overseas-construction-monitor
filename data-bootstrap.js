(function () {
  const originalFetch = window.fetch ? window.fetch.bind(window) : null;
  const SHEET_URL_PATTERN = "docs.google.com/spreadsheets/d/";
  const TIMEOUT_MS = 9000;

  if (!originalFetch) return;

  window.fetch = async function resilientFetch(input, init) {
    const url = typeof input === "string" ? input : input && input.url;
    if (!url || !url.includes(SHEET_URL_PATTERN) || !url.includes("/gviz/tq")) {
      return originalFetch(input, init);
    }

    try {
      return await withTimeout(originalFetch(input, init), TIMEOUT_MS);
    } catch (error) {
      console.warn("Google Sheets fetch fallback activated:", error);
      const data = await fetchGvizJsonp(url);
      return {
        ok: true,
        status: 200,
        text: async () => `google.visualization.Query.setResponse(${JSON.stringify(data)})`,
      };
    }
  };

  function withTimeout(promise, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Google Sheets request timed out")), timeoutMs);
      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }

  function fetchGvizJsonp(url) {
    return new Promise((resolve, reject) => {
      const callbackName = `__gvizFallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement("script");
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Google Sheets JSONP fallback timed out"));
      }, TIMEOUT_MS);

      window[callbackName] = (data) => {
        clearTimeout(timeout);
        cleanup();
        resolve(data);
      };

      script.onerror = () => {
        clearTimeout(timeout);
        cleanup();
        reject(new Error("Google Sheets JSONP fallback failed"));
      };

      const fallbackUrl = new URL(url);
      const tqx = fallbackUrl.searchParams.get("tqx") || "out:json";
      const parts = tqx
        .split(";")
        .map((part) => part.trim())
        .filter(Boolean)
        .filter((part) => !part.startsWith("responseHandler:"));
      if (!parts.some((part) => part === "out:json")) parts.unshift("out:json");
      parts.push(`responseHandler:${callbackName}`);
      fallbackUrl.searchParams.set("tqx", parts.join(";"));
      fallbackUrl.searchParams.set("_", String(Date.now()));

      script.src = fallbackUrl.toString();
      document.head.appendChild(script);

      function cleanup() {
        delete window[callbackName];
        script.remove();
      }
    });
  }
})();
