import fs from "node:fs/promises";

const targets = [
  "assets/css/market.css",
  "assets/css/projects.css",
  "assets/css/project.css",
];

const START = "/* PREVIOUS_HEADER_RESTORE_START */";
const END = "/* PREVIOUS_HEADER_RESTORE_END */";

const restoreCss = `${START}
/*
 * Restore the pre-refactor top navigation/header presentation.
 * This block intentionally overrides only the page header. The integrated
 * page bundles, filters, tables, cards, data loading, and responsive body
 * layout remain unchanged.
 */
body.production-ui .site-header {
  position: relative !important;
  display: flex !important;
  align-items: center !important;
  flex-direction: column !important;
  gap: 12px !important;
  min-height: 0 !important;
  width: min(1680px, calc(100% - 32px)) !important;
  margin: 18px auto 8px !important;
  padding: 20px 72px 18px !important;
  overflow: hidden !important;
  border: 1px solid rgba(15, 45, 79, 0.11) !important;
  border-radius: 30px !important;
  color: #15253a !important;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(243, 249, 255, 0.9)),
    radial-gradient(circle at 18% 32%, rgba(218, 234, 251, 0.72), transparent 19rem),
    radial-gradient(circle at 88% 45%, rgba(232, 242, 253, 0.95), transparent 17rem) !important;
  box-shadow: 0 18px 42px rgba(15, 45, 79, 0.08) !important;
  backdrop-filter: blur(14px) !important;
}

body.production-ui .site-header::before,
body.production-ui .site-header::after {
  position: absolute !important;
  z-index: 0 !important;
  display: block !important;
  content: "" !important;
  pointer-events: none !important;
}

body.production-ui .site-header::before {
  inset: 24px auto auto 28px !important;
  width: 120px !important;
  height: 62px !important;
  border: 1px solid rgba(27, 95, 158, 0.12) !important;
  border-radius: 22px !important;
  background:
    linear-gradient(90deg, rgba(27, 95, 158, 0.08) 1px, transparent 1px),
    linear-gradient(180deg, rgba(27, 95, 158, 0.08) 1px, transparent 1px) !important;
  background-size: 24px 24px !important;
  opacity: 0.72 !important;
}

body.production-ui .site-header::after {
  inset: auto 86px 18px auto !important;
  width: 135px !important;
  height: 70px !important;
  border: 0 !important;
  border-radius: 999px !important;
  background:
    radial-gradient(circle at 22% 50%, rgba(27, 95, 158, 0.16) 0 6px, transparent 7px),
    radial-gradient(circle at 50% 50%, rgba(27, 95, 158, 0.12) 0 6px, transparent 7px),
    radial-gradient(circle at 78% 50%, rgba(27, 95, 158, 0.09) 0 6px, transparent 7px) !important;
  opacity: 0.78 !important;
}

body.production-ui .brand-wrap,
body.production-ui .header-actions,
body.production-ui .page-nav,
body.production-ui .action-button {
  position: relative !important;
  z-index: 1 !important;
}

body.production-ui .brand,
body.production-ui .brand-fallback,
body.production-ui .brand-wrap .eyebrow,
body.production-ui .brand-wrap h1,
body.production-ui .brand-wrap .subtitle,
body.production-ui .sync-status {
  display: none !important;
}

body.production-ui .brand-wrap {
  order: 2 !important;
  display: flex !important;
  justify-content: center !important;
  width: 100% !important;
  min-width: 0 !important;
  animation: none !important;
}

body.production-ui .brand-wrap > div {
  animation: none !important;
}

body.production-ui .header-actions {
  order: 1 !important;
  display: contents !important;
  width: 100% !important;
  animation: none !important;
}

body.production-ui .page-nav {
  display: flex !important;
  align-items: stretch !important;
  justify-content: center !important;
  gap: 8px !important;
  width: min(760px, 100%) !important;
  padding: 7px !important;
  border: 1px solid rgba(15, 45, 79, 0.12) !important;
  border-radius: 26px !important;
  background: rgba(237, 245, 255, 0.92) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.92), 0 10px 26px rgba(15, 45, 79, 0.06) !important;
}

body.production-ui .page-nav a {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  flex: 1 1 0 !important;
  min-width: 0 !important;
  min-height: 56px !important;
  padding: 0 22px !important;
  border: 0 !important;
  border-radius: 21px !important;
  color: #4e667c !important;
  background: rgba(255, 255, 255, 0.64) !important;
  box-shadow: none !important;
  font-size: clamp(1.05rem, 1.7vw, 1.28rem) !important;
  font-weight: 950 !important;
  line-height: 1.05 !important;
  text-align: center !important;
  text-decoration: none !important;
  letter-spacing: -0.035em !important;
  transform: none !important;
  transition: flex-basis 190ms ease, transform 190ms ease, background 190ms ease, color 190ms ease, box-shadow 190ms ease !important;
}

body.production-ui .page-nav a.is-active {
  flex: 1.45 1 0 !important;
  min-height: 68px !important;
  color: #ffffff !important;
  background: linear-gradient(135deg, #0f2d4f, #1b5f9e) !important;
  box-shadow: 0 16px 34px rgba(15, 45, 79, 0.2) !important;
  font-size: clamp(1.22rem, 2.2vw, 1.62rem) !important;
  transform: translateY(-2px) !important;
  outline: 0 !important;
}

body.production-ui .page-nav a:hover,
body.production-ui .page-nav a:focus-visible {
  color: #0f2d4f !important;
  background: #ffffff !important;
  transform: translateY(-1px) !important;
}

body.production-ui .page-nav a.is-active:hover,
body.production-ui .page-nav a.is-active:focus-visible {
  color: #ffffff !important;
  background: linear-gradient(135deg, #0f2d4f, #1b5f9e) !important;
  transform: translateY(-2px) !important;
}

body.production-ui .action-button {
  position: absolute !important;
  top: 50% !important;
  right: 18px !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 42px !important;
  min-width: 42px !important;
  height: 42px !important;
  min-height: 42px !important;
  padding: 0 !important;
  border: 1px solid rgba(15, 45, 79, 0.13) !important;
  border-radius: 999px !important;
  color: #0f2d4f !important;
  background: rgba(255, 255, 255, 0.88) !important;
  box-shadow: 0 10px 20px rgba(15, 45, 79, 0.08) !important;
  transform: translateY(-50%) !important;
}

@media (max-width: 980px) {
  body.production-ui .site-header {
    display: flex !important;
    padding: 14px 58px !important;
  }

  body.production-ui .site-header::before,
  body.production-ui .site-header::after {
    opacity: 0.42 !important;
  }

  body.production-ui .header-actions {
    display: contents !important;
  }

  body.production-ui .page-nav {
    width: min(760px, 100%) !important;
  }
}

@media (max-width: 760px) {
  body.production-ui .site-header {
    display: flex !important;
    width: calc(100% - 16px) !important;
    margin-top: 10px !important;
    padding: 11px 50px 11px 11px !important;
    border-radius: 22px !important;
  }

  body.production-ui .site-header::before,
  body.production-ui .site-header::after {
    display: none !important;
  }

  body.production-ui .brand-wrap {
    display: flex !important;
  }

  body.production-ui .header-actions {
    display: contents !important;
  }

  body.production-ui .page-nav {
    width: 100% !important;
    gap: 5px !important;
    padding: 5px !important;
    border-radius: 21px !important;
  }

  body.production-ui .page-nav a {
    flex: 1 1 0 !important;
    min-width: 0 !important;
    min-height: 48px !important;
    padding: 0 8px !important;
    border-radius: 17px !important;
    font-size: 0.9rem !important;
  }

  body.production-ui .page-nav a.is-active {
    flex: 1.28 1 0 !important;
    min-height: 56px !important;
    font-size: 1.04rem !important;
  }

  body.production-ui .action-button {
    right: 10px !important;
    width: 34px !important;
    min-width: 34px !important;
    height: 34px !important;
    min-height: 34px !important;
    font-size: 0.86rem !important;
  }
}
${END}`;

for (const file of targets) {
  let css = await fs.readFile(file, "utf8");
  const startIndex = css.indexOf(START);
  const endIndex = css.indexOf(END);
  if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) {
    css = `${css.slice(0, startIndex).trimEnd()}\n`;
  }
  await fs.writeFile(file, `${css.trimEnd()}\n\n${restoreCss}\n`, "utf8");
  console.log(`Restored previous header in ${file}`);
}
