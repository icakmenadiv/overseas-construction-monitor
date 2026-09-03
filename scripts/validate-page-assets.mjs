import { createHash } from "node:crypto";
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const CONFIG_PATH = "config/page-assets.json";
const errors = [];
const warnings = [];
const cssGraph = new Map();
const cssVisited = new Set();

const config = JSON.parse(await readText(CONFIG_PATH));

for (const [pagePath, expected] of Object.entries(config.productionPages || {})) {
  const html = await readText(pagePath);
  const actual = extractPageAssets(html, pagePath);

  compareOrdered(`${pagePath} styles`, actual.styles, expected.styles || []);
  compareOrdered(`${pagePath} scripts`, actual.scripts, expected.scripts || []);

  for (const asset of [...actual.styles, ...actual.scripts]) {
    await requireFile(asset, `${pagePath} references missing asset`);
  }

  for (const stylesheet of actual.styles) {
    await walkCss(stylesheet, []);
  }
}

for (const dataPath of config.runtimeData || []) {
  await requireFile(dataPath, "Configured runtime data is missing");
}

for (const pagePath of config.historicalPages || []) {
  if (!(await exists(pagePath))) {
    warnings.push(`Historical page is not present: ${pagePath}`);
  }
}

for (const [legacyPath, expectedImports] of Object.entries(config.legacyCompatibility || {})) {
  await requireFile(legacyPath, "Legacy compatibility entrypoint is missing");
  await walkCss(legacyPath, []);
  compareOrdered(
    `${legacyPath} direct imports`,
    cssGraph.get(legacyPath) || [],
    expectedImports || [],
  );
}

for (const [canonicalPath, metadata] of Object.entries(config.canonicalStyles || {})) {
  await requireFile(canonicalPath, "Canonical stylesheet is missing");
  const source = await readBuffer(canonicalPath);
  if (source.length === 0) errors.push(`Canonical stylesheet is empty: ${canonicalPath}`);

  if (metadata?.baselineGitBlobSha) {
    const actualSha = gitBlobSha(source);
    if (actualSha !== metadata.baselineGitBlobSha) {
      errors.push(
        `${canonicalPath} content changed without updating its reviewed baseline hash: ` +
          `expected ${metadata.baselineGitBlobSha}, got ${actualSha}`,
      );
    }
  }
}

for (const pagePath of Object.keys(config.productionPages || {})) {
  const html = await readText(pagePath);
  const { styles } = extractPageAssets(html, pagePath);
  const reachable = collectCssDependencies(styles);
  for (const canonicalPath of Object.keys(config.canonicalStyles || {})) {
    if (!reachable.has(canonicalPath)) {
      errors.push(`${pagePath} does not reach canonical stylesheet: ${canonicalPath}`);
    }
  }
}

printSummary();

if (errors.length) {
  console.error("\nAsset validation failed:\n");
  errors.forEach((message) => console.error(`- ${message}`));
  if (warnings.length) {
    console.error("\nWarnings:\n");
    warnings.forEach((message) => console.error(`- ${message}`));
  }
  process.exit(1);
}

console.log("\nAsset validation passed.");
if (warnings.length) {
  console.warn("\nWarnings:");
  warnings.forEach((message) => console.warn(`- ${message}`));
}

function extractPageAssets(html, pagePath) {
  const styles = [];
  const scripts = [];

  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    const rel = getAttribute(tag, "rel").toLowerCase();
    const href = getAttribute(tag, "href");
    if (!rel.split(/\s+/).includes("stylesheet") || !href) continue;
    const resolved = resolveLocal(pagePath, href);
    if (resolved) styles.push(resolved);
  }

  for (const tag of html.match(/<script\b[^>]*>/gi) || []) {
    const src = getAttribute(tag, "src");
    if (!src) continue;
    const resolved = resolveLocal(pagePath, src);
    if (resolved) scripts.push(resolved);
  }

  return { styles, scripts };
}

function getAttribute(tag, name) {
  const pattern = new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i");
  return tag.match(pattern)?.[2]?.trim() || "";
}

async function walkCss(filePath, stack) {
  if (cssVisited.has(filePath)) return;
  if (stack.includes(filePath)) {
    errors.push(`CSS import cycle: ${[...stack, filePath].join(" -> ")}`);
    return;
  }

  if (!(await exists(filePath))) {
    errors.push(`Cannot inspect missing stylesheet: ${filePath}`);
    return;
  }

  const css = await readText(filePath);
  const imports = [];
  const importPattern = /@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?[^;]*;/gi;
  let match;

  while ((match = importPattern.exec(css))) {
    const resolved = resolveLocal(filePath, match[1]);
    if (!resolved) continue;
    imports.push(resolved);
    await requireFile(resolved, `${filePath} imports missing stylesheet`);
  }

  cssGraph.set(filePath, imports);
  cssVisited.add(filePath);

  for (const imported of imports) {
    await walkCss(imported, [...stack, filePath]);
  }
}

function collectCssDependencies(entryStyles) {
  const result = new Set();
  const queue = [...entryStyles];
  while (queue.length) {
    const current = queue.shift();
    if (!current || result.has(current)) continue;
    result.add(current);
    queue.push(...(cssGraph.get(current) || []));
  }
  return result;
}

function compareOrdered(label, actual, expected) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) return;
  errors.push(
    `${label} changed.\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`,
  );
}

function resolveLocal(fromFile, reference) {
  const clean = normalizeReference(reference);
  if (!clean) return "";
  const base = path.posix.dirname(fromFile.replaceAll("\\", "/"));
  const resolved = clean.startsWith("/")
    ? path.posix.normalize(clean.slice(1))
    : path.posix.normalize(path.posix.join(base, clean));

  if (resolved === ".." || resolved.startsWith("../")) {
    errors.push(`Reference escapes repository root: ${fromFile} -> ${reference}`);
    return "";
  }
  return resolved.replace(/^\.\//, "");
}

function normalizeReference(reference) {
  const value = String(reference || "").trim();
  if (!value || value.startsWith("#")) return "";
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)) return "";
  return value.split(/[?#]/, 1)[0].replaceAll("\\", "/");
}

async function requireFile(filePath, context) {
  if (!(await exists(filePath))) {
    errors.push(`${context}: ${filePath}`);
    return false;
  }
  const info = await stat(path.join(ROOT, filePath));
  if (!info.isFile()) {
    errors.push(`${context}; path is not a file: ${filePath}`);
    return false;
  }
  return true;
}

async function exists(filePath) {
  try {
    await access(path.join(ROOT, filePath));
    return true;
  } catch {
    return false;
  }
}

async function readText(filePath) {
  return readFile(path.join(ROOT, filePath), "utf8");
}

async function readBuffer(filePath) {
  return readFile(path.join(ROOT, filePath));
}

function gitBlobSha(buffer) {
  const header = Buffer.from(`blob ${buffer.length}\0`);
  return createHash("sha1").update(header).update(buffer).digest("hex");
}

function printSummary() {
  console.log("Page asset validation summary");
  console.log(`- migration phase: ${config.migrationPhase || "unspecified"}`);
  console.log(`- production pages: ${Object.keys(config.productionPages || {}).length}`);
  console.log(`- canonical styles: ${Object.keys(config.canonicalStyles || {}).length}`);
  console.log(`- CSS files inspected: ${cssVisited.size}`);
  console.log(`- runtime data files: ${(config.runtimeData || []).length}`);
}
