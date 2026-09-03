(() => {
  const rowById = new Map();
  let expandedId = "";

  const originalCreateMainRow = window.createMainRow;
  const originalCreateDetailRow = window.createDetailRow;

  if (typeof originalCreateMainRow !== "function" || typeof originalCreateDetailRow !== "function") return;

  patchProjectDetailUrlBuilder();

  window.createMainRow = function optimizedCreateMainRow(row, isExpanded) {
    rowById.set(String(row.id), row);
    const tr = originalCreateMainRow.call(this, row, isExpanded);
    tr.dataset.rowId = String(row.id);
    tr.dataset.mainRow = "true";
    return tr;
  };

  window.toggleDetail = function optimizedToggleDetail(id) {
    const rowId = String(id);
    const currentDetail = document.querySelector("#resultBody tr.detail-row[data-detail-for]");
    const currentMain = currentDetail
      ? document.querySelector(`#resultBody tr[data-main-row="true"][data-row-id="${cssEscape(currentDetail.dataset.detailFor)}"]`)
      : null;

    if (currentDetail) currentDetail.remove();
    if (currentMain) setExpanded(currentMain, false);

    if (expandedId === rowId) {
      expandedId = "";
      return;
    }

    const mainRow = document.querySelector(`#resultBody tr[data-main-row="true"][data-row-id="${cssEscape(rowId)}"]`);
    const row = rowById.get(rowId);
    if (!mainRow || !row) {
      expandedId = "";
      return;
    }

    const detailRow = originalCreateDetailRow.call(this, row);
    detailRow.dataset.detailFor = rowId;
    const headerCount = document.querySelector(".market-table thead tr")?.children.length;
    const detailCell = detailRow.querySelector("td");
    if (detailCell && headerCount) detailCell.colSpan = headerCount;

    mainRow.insertAdjacentElement("afterend", detailRow);
    setExpanded(mainRow, true);
    expandedId = rowId;

    window.InterestFeature?.enhanceAll?.();
  };

  function patchProjectDetailUrlBuilder() {
    window.buildProjectDetailUrl = function buildProjectDetailUrlPatched(row) {
      const params = new URLSearchParams();
      if (row["프로젝트 고유값"]) params.set("id", row["프로젝트 고유값"]);
      if (row["프로젝트명"]) params.set("name", row["프로젝트명"]);
      if (row["국가"]) params.set("country", row["국가"]);
      if (row["섹터"]) params.set("sector", row["섹터"]);
      return `./project.html?${params.toString()}`;
    };
  }

  function setExpanded(row, expanded) {
    const button = row.querySelector(".detail-button");
    if (!button) return;
    button.setAttribute("aria-expanded", String(expanded));
    button.textContent = expanded ? "−" : "+";
  }

  function cssEscape(value) {
    if (window.CSS?.escape) return CSS.escape(value);
    return String(value).replace(/["\\]/g, "\\$&");
  }
})();