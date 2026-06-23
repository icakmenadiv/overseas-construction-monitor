(() => {
  const SHEET_ID = "11WmfuDj7FSk5LRvEB2CArVETZOA9NgpySLYscG223-E";
  const RANGES_BY_GID = {
    "748239675": "A1:R50000",
    "20260612": "A1:M20000",
  };

  if (!window.fetch) return;

  const originalFetch = window.fetch.bind(window);
  const getUrlText = (resource) => (typeof resource === "string" ? resource : resource?.url || "");
  const getTrackedRange = (resource) => {
    const url = getUrlText(resource);
    if (!url.includes("docs.google.com/spreadsheets") || !url.includes(`/d/${SHEET_ID}/`)) return "";
    if (!url.includes("headers=1") || !url.includes("tqx=out:json")) return "";

    return Object.entries(RANGES_BY_GID).find(([gid]) => url.includes(`gid=${gid}`))?.[1] || "";
  };

  const withRange = (resource, range) => {
    const url = new URL(getUrlText(resource));
    url.searchParams.set("range", range);
    return url.toString();
  };

  window.fetch = (resource, options) => {
    const range = getTrackedRange(resource);
    return range ? originalFetch(withRange(resource, range), options) : originalFetch(resource, options);
  };
})();