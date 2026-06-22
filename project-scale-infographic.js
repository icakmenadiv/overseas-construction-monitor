(() => {
  const SECTION_ID = "projectScaleInfographic";
  const MAX_ITEMS = 5;
  const MAX_COUNTRIES = 4;

  document.addEventListener("DOMContentLoaded", () => {
    ensureSection();
    bindProjectInfographicObservers();
    renderWhenReady();
  });

  function bindProjectInfographicObservers() {
    const projectBody = document.getElementById("projectBody");
    if (projectBody) {
      new MutationObserver(renderProjectScaleInfographic).observe(projectBody, { childList: true });
    }

    ["sectorFilter", "stageFilter", "regionFilter", "countryFilter", "includeSmallCost", "includeUnknownCost"].forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.addEventListener("change", () => setTimeout(renderProjectScaleInfographic, 0));
    });
  }

  function renderWhenReady() {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      renderProjectScaleInfographic();
      if (getProjects().length || attempts > 30) clearInterval(timer);
    }, 250);
  }

  function ensureSection() {
    if (document.getElementById(SECTION_ID)) return;
    const summary = document.querySelector(".summary-grid");
    if (!summary) return;

    const section = document.createElement("section");
    section.id = SECTION_ID;
    section.className = "scale-infographic";
    section.setAttribute("aria-label", "프로젝트 규모 인포그래픽");
    summary.parentNode.insertBefore(section, summary);
  }

  function renderProjectScaleInfographic() {
    const section = document.getElementById(SECTION_ID);
    if (!section) return;

    const wasOpen = section.querySelector("details.scale-details")?.open ?? true;
    const projects = getProjects().filter((project) => project.costKnown && project.costValue > 0);
    if (!projects.length) {
      section.hidden = true;
      section.innerHTML = "";
      return;
    }

    const total = projects.reduce((sum, project) => sum + project.costValue, 0);
    const sectorData = aggregateProjects(projects, "sector").slice(0, MAX_ITEMS);
    const stageData = aggregateProjects(projects, "stage").slice(0, MAX_ITEMS);
    const regionData = aggregateProjects(projects, "region").slice(0, MAX_ITEMS);
    const countryData = compactCountryData(aggregateProjects(projects, "country"));

    section.hidden = false;
    section.innerHTML = `
      <details class="scale-details" ${wasOpen ? "open" : ""}>
        <summary class="scale-summary">
          <div>
            <h2>프로젝트 규모</h2>
          </div>
          <div class="scale-total-card">
            <span>총 사업규모</span>
            <strong>${escapeHtml(formatScaleAmount(total))}</strong>
          </div>
        </summary>
        <div class="scale-toolbar">
          <button type="button" class="scale-reset-button">필터 초기화</button>
        </div>
        <div class="scale-insight-grid">
          ${renderPanel("지역별", "region", regionData, getCheckedValuesById("regionFilter"))}
          ${renderPanel("국가별", "country", countryData, getCheckedValuesById("countryFilter"))}
          ${renderPanel("섹터별", "sector", sectorData, getCheckedValuesById("sectorFilter"))}
          ${renderPanel("단계별", "stage", stageData, getCheckedValuesById("stageFilter"))}
        </div>
      </details>
    `;

    section.querySelector(".scale-reset-button")?.addEventListener("click", (event) => {
      event.preventDefault();
      document.getElementById("resetButton")?.click();
      setTimeout(renderProjectScaleInfographic, 0);
    });

    section.querySelectorAll(".scale-rank-button").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.dataset.filterDisabled === "true") return;
        applySingleFilter(button.dataset.filterType, button.dataset.filterValue);
      });
    });
  }

  function renderPanel(title, filterType, data, activeValues) {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    const rows = data
      .map((item, index) => {
        const pct = total ? Math.max(3, Math.round((item.value / total) * 100)) : 0;
        const active = activeValues.includes(item.name) ? " is-active" : "";
        const disabled = item.isOther ? "true" : "false";
        return `
          <button type="button" class="scale-rank-button${active}${item.isOther ? " is-other" : ""}" data-filter-type="${filterType}" data-filter-value="${escapeAttribute(item.name)}" data-filter-disabled="${disabled}" style="--scale-pct:${pct}%; --scale-index:${index};">
            <span class="scale-rank-no">${index + 1}</span>
            <span class="scale-rank-main">
              <strong>${escapeHtml(item.label || item.name)}</strong>
              <em>${escapeHtml(formatScaleAmount(item.value))}</em>
            </span>
            <span class="scale-rank-pct">${total ? Math.round((item.value / total) * 100) : 0}%</span>
          </button>
        `;
      })
      .join("");

    return `
      <article class="scale-panel-card">
        <div class="scale-panel-head">
          <span>${escapeHtml(title)}</span>
          <strong>${escapeHtml(formatScaleAmount(total))}</strong>
        </div>
        <div class="scale-rank-list">${rows}</div>
      </article>
    `;
  }

  function aggregateProjects(projects, key) {
    const map = new Map();
    projects.forEach((project) => {
      const name = project[key] || "미분류";
      const current = map.get(name) || 0;
      map.set(name, current + project.costValue);
    });
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "ko"));
  }

  function compactCountryData(data) {
    if (data.length <= MAX_COUNTRIES) return data;
    const visible = data.slice(0, MAX_COUNTRIES);
    const rest = data.slice(MAX_COUNTRIES);
    const restValue = rest.reduce((sum, item) => sum + item.value, 0);
    const firstRest = rest[0]?.name || "기타";
    return [
      ...visible,
      {
        name: "__other_countries__",
        label: `${firstRest} 외 ${rest.length - 1}개국`,
        value: restValue,
        isOther: true,
      },
    ];
  }

  function applySingleFilter(type, value) {
    const containerId = {
      region: "regionFilter",
      country: "countryFilter",
      sector: "sectorFilter",
      stage: "stageFilter",
    }[type];
    const container = document.getElementById(containerId);
    if (!container || !value) return;

    const inputs = [...container.querySelectorAll('input[type="checkbox"]')];
    const target = inputs.find((input) => input.value === value);
    const wasOnlyActive = target?.checked && inputs.filter((input) => input.checked).length === 1;
    inputs.forEach((input) => {
      input.checked = false;
    });
    if (target && !wasOnlyActive) target.checked = true;
    container.dispatchEvent(new Event("change", { bubbles: true }));
    setTimeout(renderProjectScaleInfographic, 0);
  }

  function getProjects() {
    try {
      if (Array.isArray(state?.filteredProjects)) return state.filteredProjects;
    } catch (error) {
      return [];
    }
    return [];
  }

  function getCheckedValuesById(id) {
    const container = document.getElementById(id);
    if (!container) return [];
    return [...container.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value);
  }

  function formatScaleAmount(value) {
    if (!Number.isFinite(value) || value <= 0) return "-";
    if (typeof formatCost === "function") {
      return formatCost({ costKnown: true, costValue: value });
    }
    if (value >= 100_000_000) return `${formatCompact(value / 100_000_000)}억불`;
    return `${formatCompact(value / 1_000_000)}백만불`;
  }

  function formatCompact(value) {
    const rounded = Math.round(value * 10) / 10;
    return new Intl.NumberFormat("ko-KR").format(Number.isInteger(rounded) ? rounded : rounded);
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
})();
