(() => {
  const SHEET_ID = "11WmfuDj7FSk5LRvEB2CArVETZOA9NgpySLYscG223-E";
  const SHEET_GID = "748239675";
  let rowMapPromise = null;

  function initCardRowExpand() {
    const grid = document.getElementById("topNewsCards");
    if (!grid) return;

    observeCards(grid);
    transformCards(grid);

    if (grid.dataset.rowExpandReady !== "true") {
      grid.dataset.rowExpandReady = "true";
      grid.addEventListener(
        "click",
        (event) => {
          const toggle = event.target.closest(".top-news-toggle");
          if (!toggle) return;
          const card = toggle.closest(".top-news-card");
          if (!card) return;

          event.preventDefault();
          event.stopPropagation();
          if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();

          const willExpand = !card.classList.contains("is-expanded");
          const rowCards = getSameRowCards(grid, card);
          rowCards.forEach((rowCard) => setCardExpanded(rowCard, willExpand));
        },
        true,
      );
    }
  }

  function observeCards(grid) {
    if (grid.dataset.rowExpandObserverReady === "true") return;
    grid.dataset.rowExpandObserverReady = "true";
    new MutationObserver(() => transformCards(grid)).observe(grid, {
      childList: true,
      subtree: true,
    });
  }

  async function transformCards(grid) {
    const cards = [...grid.querySelectorAll(".top-news-card")].filter((card) => card.dataset.rowExpandableReady !== "true");
    if (!cards.length) return;

    const rowMap = await getRowMap().catch(() => new Map());
    cards.forEach((card) => transformCard(card, rowMap));
  }

  function transformCard(card, rowMap) {
    if (card.dataset.rowExpandableReady === "true") return;
    card.dataset.rowExpandableReady = "true";
    card.classList.add("top-news-card-expandable");

    const originalTitle = (card.querySelector("h3")?.textContent || "").trim();
    const row = rowMap.get(normalizeKey(originalTitle));
    const existingMeta = [...card.querySelectorAll(".top-news-meta span")]
      .map((span) => span.textContent.trim())
      .filter((text) => text && !/^TOP\s*\d+/i.test(text));
    const dateText = row?.["원문게재일"] || [...card.querySelectorAll(".top-news-foot span")].at(-1)?.textContent.trim() || "-";
    const title = row?.["제목(한글)"] || row?.["제목(원문)"] || originalTitle || "제목 없음";
    const topic = row?.["주제"] || row?.["정보 분류"] || card.querySelector("p")?.textContent.trim() || "핵심 키워드 없음";
    const detail = row?.["내용"] || "상세 내용이 없습니다.";
    const sourceLink = row?.["출처링크"]
      ? `<a class="top-news-source-link" href="${escapeAttribute(row["출처링크"])}" target="_blank" rel="noreferrer">원문 확인</a>`
      : "";

    card.innerHTML = `
      <button type="button" class="top-news-toggle" aria-expanded="false">
        <div class="top-news-meta">
          <span>${escapeHtml(row?.["국가"] || existingMeta[0] || "-")}</span>
          <span>${escapeHtml(row?.["섹터"] || existingMeta[1] || "-")}</span>
          <span>${escapeHtml(formatDateText(dateText))}</span>
        </div>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(topic)}</p>
      </button>
      <div class="top-news-detail" hidden>
        <p>${escapeHtml(detail)}</p>
        <div class="top-news-detail-meta">
          ${row?.["정보 분류"] ? `<span>${escapeHtml(row["정보 분류"])}</span>` : ""}
          ${row?.["관련 단계"] ? `<span>${escapeHtml(row["관련 단계"])}</span>` : ""}
          ${row?.["기사수집일"] ? `<span>기사수집일 ${escapeHtml(formatDateText(row["기사수집일"]))}</span>` : ""}
          ${sourceLink}
        </div>
      </div>
    `;
  }

  async function getRowMap() {
    if (rowMapPromise) return rowMapPromise;
    rowMapPromise = fetchRows().then((rows) => {
      const map = new Map();
      rows.forEach((row) => {
        [row["제목(한글)"], row["제목(원문)"]].filter(Boolean).forEach((title) => {
          map.set(normalizeKey(title), row);
        });
      });
      return map;
    });
    return rowMapPromise;
  }

  async function fetchRows() {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?gid=${SHEET_GID}&tqx=out:json`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const text = await response.text();
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}") + 1;
    const data = JSON.parse(text.substring(jsonStart, jsonEnd));
    const headers = data.table.cols.map((col) => col.label || "");
    return data.table.rows.map((row) => {
      const record = {};
      headers.forEach((header, index) => {
        record[header] = cleanCell(row.c[index]);
      });
      return record;
    });
  }

  function cleanCell(cell) {
    if (!cell) return "";
    return cell.f || cell.v || "";
  }

  function getSameRowCards(grid, targetCard) {
    const targetTop = Math.round(targetCard.offsetTop);
    return [...grid.querySelectorAll(".top-news-card")].filter(
      (card) => Math.abs(Math.round(card.offsetTop) - targetTop) <= 6,
    );
  }

  function setCardExpanded(card, expanded) {
    card.classList.toggle("is-expanded", expanded);
    const toggle = card.querySelector(".top-news-toggle");
    const detail = card.querySelector(".top-news-detail");
    if (toggle) toggle.setAttribute("aria-expanded", String(expanded));
    if (detail) detail.hidden = !expanded;
  }

  function normalizeKey(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function formatDateText(value) {
    const text = String(value || "").trim();
    const dateCtorMatch = text.match(/^Date\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (dateCtorMatch) {
      const date = new Date(Number(dateCtorMatch[1]), Number(dateCtorMatch[2]), Number(dateCtorMatch[3]));
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }
    return text || "-";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replaceAll("`", "&#096;");
  }

  document.addEventListener("DOMContentLoaded", () => {
    initCardRowExpand();
    window.setTimeout(initCardRowExpand, 400);
  });
})();
