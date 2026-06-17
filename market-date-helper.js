(() => {
  function initDateHelpers() {
    if (!document.querySelector(".market-dashboard")) return;
    enhanceDateInput("startDate");
    enhanceDateInput("endDate");
    injectStyles();
  }

  function enhanceDateInput(inputId) {
    const input = document.getElementById(inputId);
    if (!input || input.dataset.dateHelperReady === "true") return;
    input.dataset.dateHelperReady = "true";

    input.classList.add("enhanced-date-input");

    const helper = document.createElement("div");
    helper.className = "date-helper-row";

    const year = createSelect("년", getYearOptions());
    const month = createSelect("월", Array.from({ length: 12 }, (_, i) => i + 1));
    const day = createSelect("일", Array.from({ length: 31 }, (_, i) => i + 1));
    const todayButton = document.createElement("button");
    todayButton.type = "button";
    todayButton.className = "date-helper-today";
    todayButton.textContent = "오늘";

    helper.append(year, month, day, todayButton);
    input.insertAdjacentElement("afterend", helper);

    syncSelectsFromInput(input, year, month, day);

    [year, month, day].forEach((select) => {
      select.addEventListener("change", () => {
        const lastDay = new Date(Number(year.value), Number(month.value), 0).getDate();
        if (Number(day.value) > lastDay) day.value = String(lastDay);
        input.value = `${year.value}-${String(month.value).padStart(2, "0")}-${String(day.value).padStart(2, "0")}`;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });

    todayButton.addEventListener("click", () => {
      input.value = toDateInputValue(new Date());
      syncSelectsFromInput(input, year, month, day);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    input.addEventListener("change", () => syncSelectsFromInput(input, year, month, day));
    input.addEventListener("input", () => syncSelectsFromInput(input, year, month, day));
  }

  function createSelect(label, values) {
    const select = document.createElement("select");
    select.className = "date-helper-select";
    select.setAttribute("aria-label", label);
    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = String(value);
      option.textContent = label === "년" ? `${value}년` : `${value}${label}`;
      select.appendChild(option);
    });
    return select;
  }

  function getYearOptions() {
    const current = new Date().getFullYear();
    const years = [];
    for (let year = current + 1; year >= 2010; year -= 1) years.push(year);
    return years;
  }

  function syncSelectsFromInput(input, year, month, day) {
    const parsed = input.value ? new Date(`${input.value}T00:00:00`) : new Date();
    if (Number.isNaN(parsed.getTime())) return;
    year.value = String(parsed.getFullYear());
    month.value = String(parsed.getMonth() + 1);
    day.value = String(parsed.getDate());
  }

  function toDateInputValue(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function injectStyles() {
    if (document.getElementById("marketDateHelperStyles")) return;
    const style = document.createElement("style");
    style.id = "marketDateHelperStyles";
    style.textContent = `
      .enhanced-date-input {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        margin: 0 !important;
        padding: 0 !important;
        border: 0 !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      .date-helper-row {
        display: grid;
        grid-template-columns: 1.15fr 0.85fr 0.85fr auto;
        gap: 7px;
        margin-top: 8px;
      }

      .date-helper-select,
      .date-helper-today {
        min-height: 42px;
        border: 1px solid rgba(18, 83, 164, 0.18);
        border-radius: 12px;
        color: var(--slate-700);
        background: rgba(255, 255, 255, 0.92);
        font-size: 0.86rem;
        font-weight: 850;
        cursor: pointer;
      }

      .date-helper-select {
        padding: 0 8px;
      }

      .date-helper-today {
        padding: 0 11px;
        color: var(--blue-700);
      }

      .date-helper-select:focus,
      .date-helper-today:focus {
        outline: 3px solid rgba(49, 213, 233, 0.22);
        border-color: rgba(22, 166, 201, 0.55);
      }

      @media (max-width: 760px) {
        .date-helper-row {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .date-helper-today {
          grid-column: 1 / -1;
        }
      }
    `;
    document.head.appendChild(style);
  }

  document.addEventListener("DOMContentLoaded", initDateHelpers);
})();
