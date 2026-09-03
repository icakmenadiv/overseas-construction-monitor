(() => {
  const MOBILE_QUERY = "(max-width: 760px)";
  let styleInjected = false;

  document.addEventListener("DOMContentLoaded", init);
  if (document.readyState !== "loading") init();

  function init() {
    injectStyles();
    setupToggle();
    window.addEventListener("resize", debounce(setupToggle, 180));
  }

  function setupToggle() {
    const panel = document.querySelector(".control-panel");
    if (!panel) return;

    let button = document.getElementById("mobileFilterToggle");
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.id = "mobileFilterToggle";
      button.className = "mobile-filter-toggle";
      button.setAttribute("aria-controls", "mobileFilterBody");
      panel.parentNode.insertBefore(button, panel);
    }

    let body = document.getElementById("mobileFilterBody");
    if (!body) {
      body = document.createElement("div");
      body.id = "mobileFilterBody";
      body.className = "mobile-filter-body";
      while (panel.firstChild) body.appendChild(panel.firstChild);
      panel.appendChild(body);
    }

    const isMobile = window.matchMedia(MOBILE_QUERY).matches;
    panel.classList.toggle("has-mobile-filter-toggle", isMobile);
    button.hidden = !isMobile;

    if (isMobile) {
      const savedOpen = sessionStorage.getItem(getStorageKey());
      const shouldOpen = savedOpen === "open";
      setOpen(panel, button, body, shouldOpen);
      if (button.dataset.bound !== "true") {
        button.dataset.bound = "true";
        button.addEventListener("click", () => {
          const nextOpen = !panel.classList.contains("is-mobile-filter-open");
          setOpen(panel, button, body, nextOpen);
          sessionStorage.setItem(getStorageKey(), nextOpen ? "open" : "closed");
        });
      }
    } else {
      setOpen(panel, button, body, true);
    }
  }

  function setOpen(panel, button, body, open) {
    panel.classList.toggle("is-mobile-filter-open", open);
    button.setAttribute("aria-expanded", String(open));
    button.innerHTML = open
      ? `<span>필터 접기</span><strong>검색·조건 숨기기</strong>`
      : `<span>필터 열기</span><strong>검색·조건 보기</strong>`;
    body.hidden = !open && window.matchMedia(MOBILE_QUERY).matches;
  }

  function getStorageKey() {
    return document.querySelector(".market-dashboard") ? "marketMobileFilterOpen" : "projectMobileFilterOpen";
  }

  function injectStyles() {
    if (styleInjected || document.getElementById("mobileFilterToggleStyles")) return;
    styleInjected = true;
    const style = document.createElement("style");
    style.id = "mobileFilterToggleStyles";
    style.textContent = `
      .mobile-filter-toggle {
        display: none;
      }

      @media (max-width: 760px) {
        .mobile-filter-toggle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          width: calc(100% - 16px);
          margin: 8px 8px 10px;
          padding: 12px 14px;
          border: 1px solid rgba(18, 83, 164, 0.18);
          border-radius: 16px;
          color: #10243d;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(236, 254, 255, 0.95));
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
          font: inherit;
          cursor: pointer;
        }

        .mobile-filter-toggle span {
          font-size: 0.96rem;
          font-weight: 950;
        }

        .mobile-filter-toggle strong {
          color: #1769c2;
          font-size: 0.75rem;
          font-weight: 900;
        }

        .mobile-filter-toggle::after {
          flex: 0 0 auto;
          width: 24px;
          height: 24px;
          border-radius: 999px;
          color: #fff;
          background: linear-gradient(135deg, #1769c2, #16a6c9);
          content: "+";
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
          font-weight: 950;
        }

        .mobile-filter-toggle[aria-expanded="true"]::after {
          content: "−";
        }

        .control-panel.has-mobile-filter-toggle {
          margin-top: 0;
        }

        .control-panel.has-mobile-filter-toggle:not(.is-mobile-filter-open) {
          display: block !important;
          padding: 0 !important;
          border: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
        }

        .control-panel.has-mobile-filter-toggle:not(.is-mobile-filter-open) .mobile-filter-body {
          display: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }
})();
