(() => {
  const SECTION_ID = "projectScaleInfographic";
  const MAX_SEGMENTS = 8;

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

    const projects = getProjects().filter((project) => project.costKnown && project.costValue > 0);
    if (!projects.length) {
      section.hidden = true;
      section.innerHTML = "";
      return;
    }

    const sectorData = aggregateProjects(projects, "sector");
    const stageData = aggregateProjects(projects, "stage");
    const total = projects.reduce((sum, project) => sum + project.costValue, 0);
    const activeSectors = getCheckedValuesById("sectorFilter");
    const activeStages = getCheckedValuesById("stageFilter");

    section.hidden = false;
    section.innerHTML = `
      <div class="scale-info-head">
        <div>
          <span class="scale-kicker">Project Scale Intelligence</span>
          <h2>프로젝트 규모 인포그래픽</h2>
          <p>현재 필터 결과의 사업비 확인 프로젝트를 섹터별·단계별 총 사업규모로 집계합니다.</p>
        </div>
        <div class="scale-total-card">
          <span>총 사업규모</span>
          <strong>${escapeHtml(formatScaleAmount(total))}</strong>
          <button type="button" class="scale-reset-button">필터 초기화</button>
        </div>
      </div>
      <div class="scale-chart-grid">
        ${renderChart("섹터별", "sector", sectorData, activeSectors)}
        ${renderChart("단계별", "stage", stageData, activeStages)}
      </div>
    `;

    section.querySelector(".scale-reset-button")?.addEventListener("click", () => {
      document.getElementById("resetButton")?.click();
      setTimeout(renderProjectScaleInfographic, 0);
    });

    section.querySelectorAll(".scale-segment, .scale-list-button").forEach((button) => {
      button.addEventListener("click", () => {
        applySingleFilter(button.dataset.filterType, button.dataset.filterValue);
      });
    });
  }

  function renderChart(title, filterType, data, activeValues) {
    const chartData = data.slice(0, MAX_SEGMENTS);
    const total = chartData.reduce((sum, item) => sum + item.value, 0);
    let offset = 0;

    const segments = chartData
      .map((item, index) => {
        const width = total ? (item.value / total) * 100 : 0;
        const style = `--scale-left:${offset}%;--scale-width:${width}%;--scale-index:${index};`;
        offset += width;
        const active = activeValues.includes(item.name) ? " is-active" : "";
        return `<button type="button" class="scale-segment${active}" style="${style}" data-filter-type="${filterType}" data-filter-value="${escapeAttribute(item.name)}" aria-label="${escapeAttribute(`${title} ${item.name} 필터 적용`)}"><span>${escapeHtml(item.name)}</span></button>`;
      })
      .join("");

    const list = chartData
      .map((item, index) => {
        const pct = total ? Math.round((item.value / total) * 100) : 0;
        const active = activeValues.includes(item.name) ? " is-active" : "";
        return `
          <button type="button" class="scale-list-button${active}" data-filter-type="${filterType}" data-filter-value="${escapeAttribute(item.name)}">
            <span class="scale-dot" aria-hidden="true">${index + 1}</span>
            <span class="scale-list-name">${escapeHtml(item.name)}</span>
            <strong>${escapeHtml(formatScaleAmount(item.value))}</strong>
            <em>${pct}%</em>
          </button>
        `;
      })
      .join("");

    return `
      <article class="scale-chart-card">
        <div class="scale-chart-title">
          <span>${escapeHtml(title)}</span>
          <strong>${escapeHtml(formatScaleAmount(total))}</strong>
        </div>
        <div class="scale-stack" role="img" aria-label="${escapeAttribute(`${title} 사업규모 누적 막대 그래프`)}">${segments}</div>
        <div class="scale-list">${list}</div>
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

  function applySingleFilter(type, value) {
    const containerId = type === "sector" ? "sectorFilter" : "stageFilter";
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