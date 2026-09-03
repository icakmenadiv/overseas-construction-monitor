import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const manifest = JSON.parse(await fs.readFile(path.join(root, "config/page-assets.json"), "utf8"));
const failures = [];

const exists = async (file) => { try { await fs.access(path.join(root, file)); return true; } catch { return false; } };
const localRefs = (html, type) => {
  const refs = [];
  const regex = type === "css" ? /<link\b[^>]*>/gi : /<script\b[^>]*>[\s\S]*?<\/script>/gi;
  for (const match of html.matchAll(regex)) {
    const tag = match[0];
    const value = type === "css" ? tag.match(/href=["']([^"']+)["']/i)?.[1] : tag.match(/src=["']([^"']+)["']/i)?.[1];
    if (!value || /^(?:[a-z]+:)?\/\//i.test(value)) continue;
    refs.push(value.split(/[?#]/, 1)[0].replace(/^\.\//, ""));
  }
  return refs;
};

for (const [page, expected] of Object.entries(manifest.productionPages)) {
  if (!(await exists(page))) { failures.push(`missing page: ${page}`); continue; }
  const html = await fs.readFile(path.join(root, page), "utf8");
  const css = localRefs(html, "css");
  const js = localRefs(html, "js");
  if (JSON.stringify(css) !== JSON.stringify(expected.stylesheets)) failures.push(`${page} CSS mismatch: ${css.join(", ")}`);
  if (JSON.stringify(js) !== JSON.stringify(expected.scripts)) failures.push(`${page} JS mismatch: ${js.join(", ")}`);
  if (!/class=["'][^"']*production-ui/.test(html)) failures.push(`${page} missing production-ui body class`);
  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/gi)].map((item) => item[1]);
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  if (duplicates.length) failures.push(`${page} duplicate ids: ${duplicates.join(", ")}`);
}

for (const file of [...manifest.bundles.css, ...manifest.bundles.js, ...manifest.dataFiles]) {
  if (!(await exists(file))) failures.push(`missing required asset: ${file}`);
}

for (const file of manifest.bundles.css) {
  if (!(await exists(file))) continue;
  const source = await fs.readFile(path.join(root, file), "utf8");
  if (/@import\b/i.test(source)) failures.push(`CSS import is forbidden: ${file}`);
  for (const match of source.matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi)) {
    const target = match[2].split(/[?#]/, 1)[0];
    if (!target || /^(?:data:|https?:|\/\/|#)/i.test(target)) continue;
    const resolved = path.normalize(path.join(root, path.dirname(file), target));
    try { await fs.access(resolved); } catch { failures.push(`broken CSS url in ${file}: ${target}`); }
  }
}

for (const file of manifest.bundles.js) {
  if (!(await exists(file))) continue;
  const source = await fs.readFile(path.join(root, file), "utf8");
  if (/params\.set\(["']id["']/i.test(source) || /[?&]id=/.test(source)) failures.push(`public project id URL detected: ${file}`);
}

for (const entry of await fs.readdir(root, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  if (entry.name.endsWith(".css") || entry.name.endsWith(".js")) failures.push(`root browser asset is forbidden: ${entry.name}`);
  if (/preview.*\.html$|.*-preview\.html$/i.test(entry.name)) failures.push(`preview HTML remains: ${entry.name}`);
  if (/-fix\.js$/i.test(entry.name)) failures.push(`fix script remains: ${entry.name}`);
}

if (failures.length) { console.error(failures.map((item) => `- ${item}`).join("\n")); process.exit(1); }
console.log(`Validated ${Object.keys(manifest.productionPages).length} production pages and ${manifest.bundles.css.length + manifest.bundles.js.length} bundles.`);
