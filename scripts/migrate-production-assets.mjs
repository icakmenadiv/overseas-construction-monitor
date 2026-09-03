import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const VERSION = "20260903-production-1";

const PAGES = [
  {
    file: "index.html",
    key: "market",
    title: "해외 건설시장 모니터링 | 해외건설협회",
    bodyClass: "page-market",
  },
  {
    file: "projects.html",
    key: "projects",
    title: "글로벌 프로젝트 모니터링 | 해외건설협회",
    bodyClass: "page-projects",
  },
  {
    file: "project.html",
    key: "project",
    title: "프로젝트 상세 | 해외건설협회",
    bodyClass: "page-project",
  },
];

const PRODUCTION_THEME = String.raw`
/* =========================================================
   Production interface refresh - 2026-09
   ========================================================= */
:root {
  --prod-navy-950: #071a2f;
  --prod-navy-900: #0b2a4a;
  --prod-blue-700: #155f9e;
  --prod-blue-600: #1e75b8;
  --prod-sky-100: #eaf4fc;
  --prod-slate-950: #172033;
  --prod-slate-700: #4c5d72;
  --prod-slate-500: #718096;
  --prod-line: rgba(20, 62, 99, 0.13);
  --prod-surface: rgba(255, 255, 255, 0.96);
  --prod-shadow: 0 16px 38px rgba(19, 50, 79, 0.09);
  --prod-shadow-soft: 0 8px 24px rgba(19, 50, 79, 0.07);
}

html {
  background: #eef3f8;
}

body.production-ui {
  color: var(--prod-slate-950) !important;
  background:
    linear-gradient(180deg, #eef4f9 0, #f7f9fc 260px, #f5f7fa 100%) !important;
  font-family: "Pretendard", "Noto Sans KR", "Apple SD Gothic Neo", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
}

body.production-ui::before {
  position: fixed;
  inset: 0 0 auto;
  z-index: -1;
  height: 330px;
  content: "";
  background:
    radial-gradient(circle at 14% 8%, rgba(57, 160, 214, 0.16), transparent 27rem),
    radial-gradient(circle at 84% 0, rgba(37, 112, 177, 0.12), transparent 24rem);
  pointer-events: none;
}

body.production-ui .site-header {
  position: relative !important;
  display: grid !important;
  grid-template-columns: minmax(0, 1fr) auto !important;
  align-items: center !important;
  gap: 24px !important;
  width: min(1680px, calc(100% - 32px)) !important;
  min-height: 0 !important;
  margin: 16px auto 10px !important;
  padding: 22px 26px !important;
  overflow: hidden !important;
  border: 1px solid rgba(255, 255, 255, 0.16) !important;
  border-radius: 22px !important;
  color: #fff !important;
  background:
    linear-gradient(120deg, rgba(7, 26, 47, 0.98), rgba(11, 42, 74, 0.97) 58%, rgba(21, 95, 158, 0.94)) !important;
  box-shadow: 0 22px 52px rgba(8, 31, 55, 0.18) !important;
  backdrop-filter: none !important;
}

body.production-ui .site-header::before {
  position: absolute !important;
  inset: 0 auto 0 0 !important;
  z-index: 0 !important;
  display: block !important;
  width: 7px !important;
  height: auto !important;
  content: "" !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: linear-gradient(180deg, #4dc1ea, #72d7d1) !important;
  opacity: 1 !important;
}

body.production-ui .site-header::after {
  position: absolute !important;
  top: -115px !important;
  right: -90px !important;
  bottom: auto !important;
  z-index: 0 !important;
  display: block !important;
  width: 310px !important;
  height: 310px !important;
  content: "" !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  border-radius: 999px !important;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.08), transparent 64%) !important;
  opacity: 1 !important;
}

body.production-ui .brand-wrap,
body.production-ui .header-actions,
body.production-ui .page-nav,
body.production-ui .action-button {
  position: relative !important;
  z-index: 1 !important;
}

body.production-ui .brand-wrap {
  order: initial !important;
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 18px !important;
  width: auto !important;
  min-width: 0 !important;
  animation: none !important;
}

body.production-ui .brand {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  flex: 0 0 auto !important;
  width: 82px !important;
  height: 54px !important;
  padding: 7px 10px !important;
  border: 1px solid rgba(255, 255, 255, 0.78) !important;
  border-radius: 12px !important;
  background: #fff !important;
  box-shadow: 0 12px 26px rgba(0, 0, 0, 0.18) !important;
  animation: none !important;
}

body.production-ui .brand-logo {
  display: block !important;
  width: 100% !important;
  max-width: 70px !important;
  max-height: 42px !important;
  object-fit: contain !important;
}

body.production-ui .brand-fallback {
  display: inline-flex !important;
  color: var(--prod-navy-900) !important;
  font-size: 0.82rem !important;
  font-weight: 900 !important;
}

body.production-ui .brand-wrap > div {
  min-width: 0 !important;
  animation: none !important;
}

body.production-ui .brand-wrap .eyebrow {
  display: block !important;
  margin: 0 0 5px !important;
  color: #72d7d1 !important;
  font-size: 0.72rem !important;
  font-weight: 900 !important;
  letter-spacing: 0.08em !important;
  text-transform: uppercase !important;
}

body.production-ui .brand-wrap h1 {
  display: block !important;
  margin: 0 !important;
  color: #fff !important;
  font-size: clamp(1.42rem, 2vw, 2.05rem) !important;
  font-weight: 900 !important;
  line-height: 1.15 !important;
  letter-spacing: -0.035em !important;
}

body.production-ui .brand-wrap .subtitle {
  display: block !important;
  max-width: 760px !important;
  margin: 7px 0 0 !important;
  color: rgba(236, 246, 255, 0.78) !important;
  font-size: 0.82rem !important;
  font-weight: 650 !important;
  line-height: 1.45 !important;
}

body.production-ui .header-actions {
  order: initial !important;
  display: grid !important;
  grid-template-columns: auto auto !important;
  grid-template-areas: "nav action" "status status" !important;
  align-items: center !important;
  justify-items: end !important;
  gap: 8px 10px !important;
  width: auto !important;
  animation: none !important;
}

body.production-ui .page-nav {
  grid-area: nav !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: flex-end !important;
  gap: 5px !important;
  width: auto !important;
  padding: 5px !important;
  border: 1px solid rgba(255, 255, 255, 0.14) !important;
  border-radius: 13px !important;
  background: rgba(255, 255, 255, 0.08) !important;
  box-shadow: none !important;
}

body.production-ui .page-nav a {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  flex: 0 1 auto !important;
  min-width: 132px !important;
  min-height: 40px !important;
  padding: 0 14px !important;
  border: 0 !important;
  border-radius: 9px !important;
  color: rgba(255, 255, 255, 0.78) !important;
  background: transparent !important;
  box-shadow: none !important;
  font-size: 0.82rem !important;
  font-weight: 850 !important;
  line-height: 1.15 !important;
  text-align: center !important;
  text-decoration: none !important;
  transform: none !important;
}

body.production-ui .page-nav a:hover,
body.production-ui .page-nav a:focus-visible {
  color: #fff !important;
  background: rgba(255, 255, 255, 0.13) !important;
  outline: 2px solid rgba(114, 215, 209, 0.7) !important;
  outline-offset: 2px !important;
  transform: none !important;
}

body.production-ui .page-nav a.is-active {
  min-height: 40px !important;
  color: var(--prod-navy-950) !important;
  background: #fff !important;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.14) !important;
  font-size: 0.82rem !important;
  transform: none !important;
}

body.production-ui .action-button {
  position: static !important;
  grid-area: action !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 42px !important;
  min-width: 42px !important;
  height: 42px !important;
  min-height: 42px !important;
  padding: 0 !important;
  border: 1px solid rgba(255, 255, 255, 0.18) !important;
  border-radius: 11px !important;
  color: #fff !important;
  background: rgba(255, 255, 255, 0.1) !important;
  box-shadow: none !important;
  transform: none !important;
}

body.production-ui .sync-status {
  grid-area: status !important;
  display: block !important;
  margin: 0 !important;
  color: rgba(236, 246, 255, 0.66) !important;
  font-size: 0.68rem !important;
  font-weight: 700 !important;
}

body.production-ui .ai-notice {
  display: block !important;
  width: min(1680px, calc(100% - 32px)) !important;
  margin: 0 auto 10px !important;
  padding: 9px 14px !important;
  border: 1px solid rgba(21, 95, 158, 0.13) !important;
  border-radius: 11px !important;
  color: var(--prod-slate-700) !important;
  background: rgba(255, 255, 255, 0.82) !important;
  box-shadow: none !important;
  font-size: 0.72rem !important;
  line-height: 1.45 !important;
  text-align: left !important;
  animation: none !important;
}

body.production-ui .bottom-notice {
  margin-top: 4px !important;
  margin-bottom: 72px !important;
}

body.production-ui .dashboard {
  width: min(1680px, 100%) !important;
}

body.production-ui .control-panel,
body.production-ui .results-section,
body.production-ui .featured-projects,
body.production-ui .project-section,
body.production-ui .summary-item,
body.production-ui .project-meta-card,
body.production-ui .project-article-card,
body.production-ui .top-news-section {
  border-color: var(--prod-line) !important;
  background: var(--prod-surface) !important;
  box-shadow: var(--prod-shadow-soft) !important;
  backdrop-filter: none !important;
}

body.production-ui .control-panel,
body.production-ui .results-section,
body.production-ui .project-section,
body.production-ui .top-news-section {
  border-radius: 18px !important;
}

body.production-ui .summary-item {
  border-radius: 12px !important;
}

body.production-ui .summary-item::before {
  background: linear-gradient(135deg, rgba(30, 117, 184, 0.16), rgba(114, 215, 209, 0.12)) !important;
}

body.production-ui .summary-item strong,
body.production-ui .section-head h2,
body.production-ui .project-title-block h2 {
  color: var(--prod-navy-900) !important;
}

body.production-ui .top-reset-button,
body.production-ui #resetButton,
body.production-ui #exportButton,
body.production-ui .project-back-link,
body.production-ui .back-to-top,
body.production-ui .load-more-button {
  border-color: rgba(21, 95, 158, 0.18) !important;
  color: var(--prod-navy-900) !important;
  background: #fff !important;
  box-shadow: 0 6px 16px rgba(19, 50, 79, 0.07) !important;
}

body.production-ui .top-reset-button {
  color: #fff !important;
  background: linear-gradient(180deg, var(--prod-blue-600), var(--prod-blue-700)) !important;
}

body.production-ui input,
body.production-ui select,
body.production-ui .filter-summary,
body.production-ui .check-chip,
body.production-ui .cost-toggle {
  border-color: rgba(20, 62, 99, 0.14) !important;
  background: #fff !important;
}

body.production-ui input:focus,
body.production-ui select:focus,
body.production-ui button:focus-visible,
body.production-ui a:focus-visible,
body.production-ui summary:focus-visible {
  outline: 3px solid rgba(57, 160, 214, 0.24) !important;
  outline-offset: 2px !important;
}

body.production-ui .keyword-pill,
body.production-ui .pill,
body.production-ui .info-pill,
body.production-ui .stage-pill,
body.production-ui .top-news-badge,
body.production-ui .featured-project-badge {
  color: var(--prod-blue-700) !important;
  border-color: rgba(21, 95, 158, 0.15) !important;
  background: var(--prod-sky-100) !important;
}

body.production-ui .market-table thead th,
body.production-ui .project-list-table thead th {
  color: #eef7ff !important;
  background: var(--prod-navy-900) !important;
}

body.production-ui .market-table tbody tr:hover,
body.production-ui .project-list-table tbody tr:hover {
  background: #f2f7fb !important;
}

body.production-ui .site-footer {
  justify-content: flex-end !important;
  border-top-color: rgba(20, 62, 99, 0.08) !important;
}

body.production-ui .footer-brand,
body.production-ui .site-footer span {
  display: none !important;
}

body.production-ui .dashboard > *,
body.production-ui .site-header,
body.production-ui .brand,
body.production-ui .brand-wrap > div,
body.production-ui .header-actions,
body.production-ui .top-notice {
  animation: none !important;
}

@media (max-width: 980px) {
  body.production-ui .site-header {
    grid-template-columns: 1fr !important;
    align-items: stretch !important;
    gap: 16px !important;
    padding: 20px !important;
  }

  body.production-ui .header-actions {
    grid-template-columns: minmax(0, 1fr) auto !important;
    justify-items: stretch !important;
  }

  body.production-ui .page-nav {
    width: 100% !important;
  }

  body.production-ui .page-nav a {
    flex: 1 1 0 !important;
    min-width: 0 !important;
  }

  body.production-ui .sync-status {
    justify-self: start !important;
  }
}

@media (max-width: 640px) {
  body.production-ui .site-header,
  body.production-ui .ai-notice {
    width: calc(100% - 16px) !important;
  }

  body.production-ui .site-header {
    margin-top: 8px !important;
    padding: 15px !important;
    border-radius: 16px !important;
  }

  body.production-ui .brand-wrap {
    align-items: flex-start !important;
    gap: 12px !important;
  }

  body.production-ui .brand {
    width: 66px !important;
    height: 46px !important;
  }

  body.production-ui .brand-logo {
    max-width: 54px !important;
    max-height: 34px !important;
  }

  body.production-ui .brand-wrap h1 {
    font-size: 1.28rem !important;
  }

  body.production-ui .brand-wrap .subtitle {
    font-size: 0.75rem !important;
  }

  body.production-ui .header-actions {
    grid-template-columns: 1fr auto !important;
  }

  body.production-ui .page-nav a {
    min-height: 38px !important;
    padding-inline: 8px !important;
    font-size: 0.74rem !important;
  }

  body.production-ui .action-button {
    width: 40px !important;
    min-width: 40px !important;
    height: 40px !important;
  }
}
`;

function stripQuery(value) {
  return String(value || "").split(/[?#]/, 1)[0].replace(/^\.\//, "");
}

function isRemote(value) {
  return /^(?:[a-z]+:)?\/\//i.test(value) || value.startsWith("data:") || value.startsWith("#");
}

function normalizeRelative(value) {
  return path.posix.normalize(value.replaceAll("\\", "/"));
}

async function exists(relativePath) {
  try {
    await fs.access(path.join(ROOT, relativePath));
    return true;
  } catch {
    return false;
  }
}

function extractStylesheets(html) {
  const refs = [];
  const tagRe = /<link\b[^>]*>/gi;
  for (const match of html.matchAll(tagRe)) {
    const tag = match[0];
    if (!/\brel=["']stylesheet["']/i.test(tag)) continue;
    const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (href && !isRemote(href)) refs.push(stripQuery(href));
  }
  return refs;
}

function extractScripts(html) {
  const scripts = [];
  const tagRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(tagRe)) {
    const attrs = match[1] || "";
    const content = match[2] || "";
    if (/\btype=["']application\/ld\+json["']/i.test(attrs)) continue;
    const src = attrs.match(/\bsrc=["']([^"']+)["']/i)?.[1];
    if (src) {
      if (!isRemote(src)) scripts.push({ type: "file", value: stripQuery(src) });
    } else if (content.trim()) {
      scripts.push({ type: "inline", value: content.trim() });
    }
  }
  return scripts;
}

function rewriteCssUrls(css, sourcePath, outputPath) {
  return css.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (full, quote, target) => {
    if (isRemote(target)) return full;
    const cleanTarget = stripQuery(target);
    const resolved = normalizeRelative(path.posix.join(path.posix.dirname(sourcePath), cleanTarget));
    let relative = path.posix.relative(path.posix.dirname(outputPath), resolved);
    if (!relative.startsWith(".")) relative = `./${relative}`;
    const suffix = target.slice(cleanTarget.length);
    return `url(${quote || '"'}${relative}${suffix}${quote || '"'})`;
  });
}

async function inlineCss(relativePath, outputPath, stack = []) {
  const normalized = normalizeRelative(relativePath);
  if (stack.includes(normalized)) {
    throw new Error(`CSS import cycle: ${[...stack, normalized].join(" -> ")}`);
  }
  if (!(await exists(normalized))) throw new Error(`Missing CSS: ${normalized}`);

  const source = await fs.readFile(path.join(ROOT, normalized), "utf8");
  const importRe = /@import\s+(?:url\()?\s*(["'])([^"']+)\1\s*\)?\s*;?/gi;
  let output = "";
  let cursor = 0;

  for (const match of source.matchAll(importRe)) {
    output += source.slice(cursor, match.index);
    const target = match[2];
    if (isRemote(target)) {
      output += match[0];
    } else {
      const resolved = normalizeRelative(path.posix.join(path.posix.dirname(normalized), stripQuery(target)));
      output += `\n/* begin imported: ${resolved} */\n`;
      output += await inlineCss(resolved, outputPath, [...stack, normalized]);
      output += `\n/* end imported: ${resolved} */\n`;
    }
    cursor = match.index + match[0].length;
  }
  output += source.slice(cursor);
  return rewriteCssUrls(output, normalized, outputPath);
}

function extractMonitorCss(source) {
  const match = source.match(/style\.textContent\s*=\s*`([\s\S]*?)`;\s*document\.head\.appendChild\(style\);/);
  if (!match) throw new Error("Could not extract monitor-core-ui injected CSS");
  return match[1].trim();
}

function disableMonitorStyleInjection(source) {
  return source.replace(/\n\s*injectStyles\(\);/, "\n    // Static UI rules are compiled into the page stylesheet.");
}

function removePublicIdFromLinks(source) {
  return source
    .replace(/^\s*if \(row\["프로젝트 고유값"\]\) params\.set\("id", row\["프로젝트 고유값"\]\);\s*$/gm, "")
    .replace(/^\s*if \(project\.projectId\) params\.set\("id", project\.projectId\);\s*$/gm, "");
}

function removeLocalStylesheetTags(html) {
  return html.replace(/\s*<link\b[^>]*>\s*/gi, (full) => {
    if (!/\brel=["']stylesheet["']/i.test(full)) return full;
    const href = full.match(/\bhref=["']([^"']+)["']/i)?.[1] || "";
    return isRemote(href) ? full : "\n";
  });
}

function removeLocalScriptTags(html) {
  return html.replace(/\s*<script\b([^>]*)>([\s\S]*?)<\/script>\s*/gi, (full, attrs, content) => {
    if (/\btype=["']application\/ld\+json["']/i.test(attrs || "")) return full;
    const src = (attrs || "").match(/\bsrc=["']([^"']+)["']/i)?.[1];
    if (src && isRemote(src)) return full;
    return "\n";
  });
}

function updateHtml(html, page) {
  let output = removeLocalStylesheetTags(html);
  output = removeLocalScriptTags(output);
  output = output.replace(/<title>[\s\S]*?<\/title>/i, `<title>${page.title}</title>`);
  output = output.replace(/<body(?:\s+class=["'][^"']*["'])?\s*>/i, `<body class="production-ui ${page.bodyClass}">`);
  output = output.replace(
    /<\/head>/i,
    `    <link rel="stylesheet" href="./assets/css/${page.key}.css?v=${VERSION}" />\n  </head>`,
  );
  output = output.replace(
    /<\/body>/i,
    `    <script src="./assets/js/${page.key}.js?v=${VERSION}"></script>\n  </body>`,
  );
  return output.replace(/\n{3,}/g, "\n\n");
}

async function buildPage(page, monitorCss, monitorSource) {
  const htmlPath = path.join(ROOT, page.file);
  const originalHtml = await fs.readFile(htmlPath, "utf8");
  const cssOutput = `assets/css/${page.key}.css`;
  const jsOutput = `assets/js/${page.key}.js`;

  const cssParts = [];
  for (const ref of extractStylesheets(originalHtml)) {
    cssParts.push(`/* =========================================================\n   source: ${ref}\n   ========================================================= */`);
    cssParts.push(await inlineCss(ref, cssOutput));
  }
  cssParts.push("/* =========================================================\n   source: monitor-core-ui.js (moved from runtime injection)\n   ========================================================= */");
  cssParts.push(monitorCss);
  cssParts.push(PRODUCTION_THEME.trim());

  const jsParts = [];
  for (const entry of extractScripts(originalHtml)) {
    if (entry.type === "inline") {
      jsParts.push("/* inline script from production HTML */");
      jsParts.push(entry.value);
      jsParts.push(";");
      continue;
    }
    const filePath = normalizeRelative(entry.value);
    if (!(await exists(filePath))) throw new Error(`Missing JavaScript: ${filePath}`);
    let source = await fs.readFile(path.join(ROOT, filePath), "utf8");
    if (filePath === "monitor-core-ui.js") source = disableMonitorStyleInjection(monitorSource);
    source = removePublicIdFromLinks(source);
    jsParts.push(`/* =========================================================\n   source: ${filePath}\n   ========================================================= */`);
    jsParts.push(source.trim());
    jsParts.push(";");
  }

  const finalCss = `${cssParts.join("\n\n")}\n`;
  const finalJs = `${jsParts.join("\n\n")}\n`;
  if (/@import\b/i.test(finalCss)) throw new Error(`${cssOutput} still contains @import`);
  if (/params\.set\(["']id["']/i.test(finalJs)) throw new Error(`${jsOutput} exposes project id in URLs`);

  await fs.writeFile(path.join(ROOT, cssOutput), finalCss);
  await fs.writeFile(path.join(ROOT, jsOutput), finalJs);
  await fs.writeFile(htmlPath, updateHtml(originalHtml, page));

  return {
    html: page.file,
    stylesheet: cssOutput,
    script: jsOutput,
    originalStylesheets: extractStylesheets(originalHtml),
    originalScripts: extractScripts(originalHtml).filter((item) => item.type === "file").map((item) => item.value),
  };
}

async function cleanLegacyAssets() {
  const entries = await fs.readdir(ROOT, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name.endsWith(".css") || entry.name.endsWith(".js")) {
      await fs.rm(path.join(ROOT, entry.name));
      continue;
    }
    if (/preview.*\.html$|.*-preview\.html$/i.test(entry.name)) {
      await fs.rm(path.join(ROOT, entry.name));
    }
  }

  const cssDir = path.join(ROOT, "assets/css");
  for (const entry of await fs.readdir(cssDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!["market.css", "projects.css", "project.css"].includes(entry.name)) {
      await fs.rm(path.join(cssDir, entry.name));
    }
  }
}

function buildManifest(builtPages) {
  return {
    version: VERSION,
    architecture: "one stylesheet and one JavaScript bundle per production page",
    productionPages: Object.fromEntries(
      builtPages.map((page) => [page.html, { stylesheets: [page.stylesheet], scripts: [page.script] }]),
    ),
    bundles: {
      css: builtPages.map((page) => page.stylesheet),
      js: builtPages.map((page) => page.script),
    },
    deletedLegacyPatterns: ["root/*.css", "root/*.js", "*preview*.html", "*-fix.js"],
    publicIdPolicy: {
      projectId: "internal matching only; never render or place in public URLs",
      articleId: "internal matching only; never render or export",
    },
    dataFiles: ["data/articles.json", "data/projects.json", "data/meta.json", "data/view-counts.json"],
    backupBranch: "backup/pre-asset-refactor-20260903",
  };
}

async function writeDocumentation(builtPages) {
  const manifest = buildManifest(builtPages);
  await fs.mkdir(path.join(ROOT, "assets/js"), { recursive: true });
  await fs.mkdir(path.join(ROOT, "config"), { recursive: true });
  await fs.mkdir(path.join(ROOT, "docs"), { recursive: true });

  await fs.writeFile(path.join(ROOT, "config/page-assets.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await fs.writeFile(
    path.join(ROOT, "assets/css/README.md"),
    `# CSS bundles\n\n- \`market.css\`: 시장 모니터링 화면\n- \`projects.css\`: 프로젝트 목록 화면\n- \`project.css\`: 프로젝트 상세 화면\n\n각 운영 HTML은 해당 번들 하나만 직접 불러옵니다. 새 스타일은 해당 페이지 번들에 통합하며, 루트에 임시 CSS 파일을 추가하지 않습니다.\n`,
  );
  await fs.writeFile(
    path.join(ROOT, "assets/js/README.md"),
    `# JavaScript bundles\n\n- \`market.js\`: 시장 모니터링 데이터·필터·관심도·조회 추적\n- \`projects.js\`: 프로젝트 목록·사업비·정렬·조회 추적\n- \`project.js\`: 프로젝트 상세·관심도·조회 추적\n\n각 운영 HTML은 해당 번들 하나만 직접 불러옵니다. 임시 \`*-fix.js\` 파일은 만들지 않고 기능을 페이지 번들에 통합합니다.\n`,
  );
  await fs.writeFile(
    path.join(ROOT, "docs/asset-architecture.md"),
    `# 페이지 자산 운영구조\n\n## 운영 흐름\n\nAgent → Google Sheets → GitHub Actions → GitHub Pages\n\nGitHub Pages는 검색을 수행하지 않고 검증된 시트 데이터를 조회·표시합니다.\n\n## 페이지별 자산\n\n| 페이지 | CSS | JavaScript |\n| --- | --- | --- |\n${builtPages.map((page) => `| \`${page.html}\` | \`${page.stylesheet}\` | \`${page.script}\` |`).join("\n")}\n\n## 변경 원칙\n\n1. 운영 HTML에는 페이지별 CSS 1개와 JavaScript 1개만 연결합니다.\n2. \`fix\`, \`preview\`, \`fallback\` 이름의 임시 브라우저 파일을 추가하지 않습니다.\n3. 프로젝트·기사 고유값은 내부 매칭에만 쓰고 화면·URL·CSV에 노출하지 않습니다.\n4. CSS \`@import\`를 사용하지 않습니다.\n5. 변경 전 \`node scripts/validate-page-assets.mjs\`를 실행합니다.\n6. 구조개편 전 상태는 \`backup/pre-asset-refactor-20260903\` 브랜치에 보존합니다.\n`,
  );

  const readme = `# 해외 건설시장 모니터링\n\n에이전트가 조사·검증한 해외 건설·인프라 정보를 Google Sheets에 저장하고, GitHub Pages에서 조회하는 대시보드입니다.\n\n## 운영 구조\n\n**Agent → Google Sheets → GitHub Actions → GitHub Pages**\n\n- **Agent**: 외부 정보 검색, 사실확인, 분류 및 요약\n- **Google Sheets**: 운영 데이터 원본 저장\n- **GitHub Actions**: 허용된 시트 데이터를 정적 JSON으로 동기화하고 페이지 자산을 검증\n- **GitHub Pages**: 검색, 필터, 정렬 및 상세정보 표시\n\n이 저장소는 외부 기사 검색이나 AI 판단을 수행하지 않습니다. 검증이 끝난 결과를 화면에 제공하는 역할만 담당합니다.\n\n## 운영 페이지\n\n| 화면 | HTML | CSS | JavaScript |\n| --- | --- | --- | --- |\n| 시장 모니터링 | \`index.html\` | \`assets/css/market.css\` | \`assets/js/market.js\` |\n| 프로젝트 목록 | \`projects.html\` | \`assets/css/projects.css\` | \`assets/js/projects.js\` |\n| 프로젝트 상세 | \`project.html\` | \`assets/css/project.css\` | \`assets/js/project.js\` |\n\n## 운영 데이터\n\n- \`data/articles.json\`: 결과 탭 기반 기사 데이터\n- \`data/projects.json\`: 프로젝트 탭 기반 프로젝트 데이터\n- \`data/meta.json\`: 동기화 메타데이터\n- \`data/view-counts.json\`: 조회수 캐시\n\n## 개발 원칙\n\n- 루트에 임시 CSS·JavaScript를 추가하지 않습니다.\n- 기능은 페이지별 번들에 통합합니다.\n- 운영 페이지의 자산 연결은 \`config/page-assets.json\`으로 관리합니다.\n- 프로젝트·기사 고유값은 내부 매칭에만 사용하고 공개 URL과 화면에 노출하지 않습니다.\n- 자산 구조 검사는 \`node scripts/validate-page-assets.mjs\`로 수행합니다.\n\n상세 기준은 \`docs/asset-architecture.md\`를 참고합니다.\n`;
  await fs.writeFile(path.join(ROOT, "README.md"), readme);
}

async function writeValidatorWorkflow() {
  const validator = `import fs from "node:fs/promises";\nimport path from "node:path";\n\nconst root = process.cwd();\nconst manifest = JSON.parse(await fs.readFile(path.join(root, "config/page-assets.json"), "utf8"));\nconst failures = [];\n\nconst exists = async (file) => { try { await fs.access(path.join(root, file)); return true; } catch { return false; } };\nconst localRefs = (html, type) => {\n  const refs = [];\n  const regex = type === "css" ? /<link\\b[^>]*>/gi : /<script\\b[^>]*>[\\s\\S]*?<\\/script>/gi;\n  for (const match of html.matchAll(regex)) {\n    const tag = match[0];\n    const value = type === "css" ? tag.match(/href=["']([^"']+)["']/i)?.[1] : tag.match(/src=["']([^"']+)["']/i)?.[1];\n    if (!value || /^(?:[a-z]+:)?\\/\\//i.test(value)) continue;\n    refs.push(value.split(/[?#]/, 1)[0].replace(/^\\.\\//, ""));\n  }\n  return refs;\n};\n\nfor (const [page, expected] of Object.entries(manifest.productionPages)) {\n  if (!(await exists(page))) { failures.push(\`missing page: \${page}\`); continue; }\n  const html = await fs.readFile(path.join(root, page), "utf8");\n  const css = localRefs(html, "css");\n  const js = localRefs(html, "js");\n  if (JSON.stringify(css) !== JSON.stringify(expected.stylesheets)) failures.push(\`\${page} CSS mismatch: \${css.join(", ")}\`);\n  if (JSON.stringify(js) !== JSON.stringify(expected.scripts)) failures.push(\`\${page} JS mismatch: \${js.join(", ")}\`);\n  if (!/class=["'][^"']*production-ui/.test(html)) failures.push(\`\${page} missing production-ui body class\`);\n  const ids = [...html.matchAll(/\\bid=["']([^"']+)["']/gi)].map((item) => item[1]);\n  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];\n  if (duplicates.length) failures.push(\`\${page} duplicate ids: \${duplicates.join(", ")}\`);\n}\n\nfor (const file of [...manifest.bundles.css, ...manifest.bundles.js, ...manifest.dataFiles]) {\n  if (!(await exists(file))) failures.push(\`missing required asset: \${file}\`);\n}\n\nfor (const file of manifest.bundles.css) {\n  if (!(await exists(file))) continue;\n  const source = await fs.readFile(path.join(root, file), "utf8");\n  if (/@import\\b/i.test(source)) failures.push(\`CSS import is forbidden: \${file}\`);\n  for (const match of source.matchAll(/url\\(\\s*(["']?)([^"')]+)\\1\\s*\\)/gi)) {\n    const target = match[2].split(/[?#]/, 1)[0];\n    if (!target || /^(?:data:|https?:|\\/\\/|#)/i.test(target)) continue;\n    const resolved = path.normalize(path.join(root, path.dirname(file), target));\n    try { await fs.access(resolved); } catch { failures.push(\`broken CSS url in \${file}: \${target}\`); }\n  }\n}\n\nfor (const file of manifest.bundles.js) {\n  if (!(await exists(file))) continue;\n  const source = await fs.readFile(path.join(root, file), "utf8");\n  if (/params\\.set\\(["']id["']/i.test(source) || /[?&]id=/.test(source)) failures.push(\`public project id URL detected: \${file}\`);\n}\n\nfor (const entry of await fs.readdir(root, { withFileTypes: true })) {\n  if (!entry.isFile()) continue;\n  if (entry.name.endsWith(".css") || entry.name.endsWith(".js")) failures.push(\`root browser asset is forbidden: \${entry.name}\`);\n  if (/preview.*\\.html$|.*-preview\\.html$/i.test(entry.name)) failures.push(\`preview HTML remains: \${entry.name}\`);\n  if (/-fix\\.js$/i.test(entry.name)) failures.push(\`fix script remains: \${entry.name}\`);\n}\n\nif (failures.length) { console.error(failures.map((item) => \`- \${item}\`).join("\\n")); process.exit(1); }\nconsole.log(\`Validated \${Object.keys(manifest.productionPages).length} production pages and \${manifest.bundles.css.length + manifest.bundles.js.length} bundles.\`);\n`;

  const smoke = `import { chromium } from "playwright";\nimport fs from "node:fs/promises";\n\nconst base = process.env.PAGE_BASE_URL || "http://127.0.0.1:4173";\nconst output = "artifacts/screenshots";\nawait fs.mkdir(output, { recursive: true });\nconst browser = await chromium.launch({ headless: true });\nconst consoleErrors = [];\n\nasync function openPage(context, route, name, readySelector) {\n  const page = await context.newPage();\n  page.on("pageerror", (error) => consoleErrors.push(\`\${name}: \${error.message}\`));\n  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(\`\${name}: \${message.text()}\`); });\n  await page.goto(new URL(route, base).href, { waitUntil: "domcontentloaded", timeout: 120000 });\n  await page.waitForSelector("body.production-ui", { timeout: 30000 });\n  await page.waitForSelector(readySelector, { state: "visible", timeout: 120000 });\n  const assetCounts = await page.evaluate(() => ({ css: document.querySelectorAll('link[rel="stylesheet"]').length, js: document.querySelectorAll('script[src]').length }));\n  if (assetCounts.css !== 1 || assetCounts.js !== 1) throw new Error(\`\${name}: expected one CSS and one JS asset, got \${JSON.stringify(assetCounts)}\`);\n  await page.screenshot({ path: \`\${output}/\${name}.png\`, fullPage: true });\n  return page;\n}\n\nconst desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });\nconst market = await openPage(desktop, "/index.html", "market-desktop", "#tableWrap:not([hidden])");\nawait market.locator("[data-reset-filter]").first().click();\nawait market.close();\nconst projects = await openPage(desktop, "/projects.html", "projects-desktop", "#tableWrap:not([hidden])");\nconst projectHref = await projects.locator('a[href*="project.html?"]').first().getAttribute("href");\nif (!projectHref) throw new Error("projects-desktop: no project detail link found");\nif (/[?&]id=/.test(projectHref)) throw new Error(\`public project id detected: \${projectHref}\`);\nawait projects.close();\nawait openPage(desktop, projectHref, "project-desktop", "#projectContent:not([hidden])");\nawait desktop.close();\n\nconst mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });\nawait openPage(mobile, "/index.html", "market-mobile", "#tableWrap:not([hidden])");\nawait openPage(mobile, "/projects.html", "projects-mobile", "#tableWrap:not([hidden])");\nawait mobile.close();\nawait browser.close();\n\nif (consoleErrors.length) {\n  console.error(consoleErrors.join("\\n"));\n  process.exit(1);\n}\nconsole.log("Visual smoke test completed.");\n`;

  const workflow = `name: Validate production pages\n\non:\n  workflow_dispatch:\n  pull_request:\n    paths:\n      - "*.html"\n      - "assets/**"\n      - "config/page-assets.json"\n      - "scripts/validate-page-assets.mjs"\n      - "scripts/smoke-test-pages.mjs"\n      - ".github/workflows/validate-page-assets.yml"\n  push:\n    branches:\n      - main\n      - "refactor/**"\n    paths:\n      - "*.html"\n      - "assets/**"\n      - "config/page-assets.json"\n      - "scripts/validate-page-assets.mjs"\n      - "scripts/smoke-test-pages.mjs"\n      - ".github/workflows/validate-page-assets.yml"\n\npermissions:\n  contents: read\n\nconcurrency:\n  group: validate-production-pages-\${{ github.ref }}\n  cancel-in-progress: true\n\njobs:\n  validate:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v6\n      - uses: actions/setup-node@v6\n        with:\n          node-version: "24"\n          package-manager-cache: false\n      - name: Validate asset structure\n        run: node scripts/validate-page-assets.mjs\n      - name: Check JavaScript bundles\n        run: |\n          node --check assets/js/market.js\n          node --check assets/js/projects.js\n          node --check assets/js/project.js\n\n  visual-smoke:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v6\n      - uses: actions/setup-node@v6\n        with:\n          node-version: "24"\n          package-manager-cache: false\n      - name: Install browser\n        run: |\n          npm install --no-save playwright@1.55.0\n          npx playwright install --with-deps chromium\n      - name: Start local site\n        run: |\n          python3 -m http.server 4173 > /tmp/monitor-http.log 2>&1 &\n          echo $! > /tmp/monitor-http.pid\n      - name: Run desktop and mobile smoke tests\n        env:\n          PAGE_BASE_URL: http://127.0.0.1:4173\n        run: node scripts/smoke-test-pages.mjs\n      - uses: actions/upload-artifact@v4\n        if: always()\n        with:\n          name: production-page-screenshots\n          path: artifacts/screenshots\n          if-no-files-found: ignore\n`;

  await fs.writeFile(path.join(ROOT, "scripts/validate-page-assets.mjs"), validator);
  await fs.writeFile(path.join(ROOT, "scripts/smoke-test-pages.mjs"), smoke);
  await fs.writeFile(path.join(ROOT, ".github/workflows/validate-page-assets.yml"), workflow);
}

async function main() {
  await fs.mkdir(path.join(ROOT, "assets/css"), { recursive: true });
  await fs.mkdir(path.join(ROOT, "assets/js"), { recursive: true });

  const monitorSource = await fs.readFile(path.join(ROOT, "monitor-core-ui.js"), "utf8");
  const monitorCss = extractMonitorCss(monitorSource);
  const builtPages = [];
  for (const page of PAGES) builtPages.push(await buildPage(page, monitorCss, monitorSource));

  await cleanLegacyAssets();
  await writeDocumentation(builtPages);
  await writeValidatorWorkflow();

  await fs.rm(path.join(ROOT, "scripts/migrate-production-assets.mjs"), { force: true });
  await fs.rm(path.join(ROOT, ".github/workflows/run-production-migration.yml"), { force: true });

  console.log(`Built production bundles for: ${builtPages.map((page) => page.html).join(", ")}`);
}

await main();
