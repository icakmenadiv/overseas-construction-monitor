import { chromium } from "playwright";
import fs from "node:fs/promises";

const base = process.env.PAGE_BASE_URL || "http://127.0.0.1:4173";
const output = "artifacts/screenshots";
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const consoleErrors = [];

async function openPage(context, route, name, readySelector) {
  const page = await context.newPage();
  page.on("pageerror", (error) => consoleErrors.push(`${name}: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(`${name}: ${message.text()}`); });
  await page.goto(new URL(route, base).href, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector("body.production-ui", { timeout: 30000 });
  await page.waitForSelector(readySelector, { state: "visible", timeout: 120000 });
  const assetCounts = await page.evaluate(() => ({ css: document.querySelectorAll('link[rel="stylesheet"]').length, js: document.querySelectorAll('script[src]').length }));
  if (assetCounts.css !== 1 || assetCounts.js !== 1) throw new Error(`${name}: expected one CSS and one JS asset, got ${JSON.stringify(assetCounts)}`);
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
  return page;
}

const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
const market = await openPage(desktop, "/index.html", "market-desktop", "#tableWrap:not([hidden])");
await market.locator("[data-reset-filter]").first().click();
await market.close();
const projects = await openPage(desktop, "/projects.html", "projects-desktop", "#tableWrap:not([hidden])");
const projectHref = await projects.locator('a[href*="project.html?"]').first().getAttribute("href");
if (!projectHref) throw new Error("projects-desktop: no project detail link found");
if (/[?&]id=/.test(projectHref)) throw new Error(`public project id detected: ${projectHref}`);
await projects.close();
await openPage(desktop, projectHref, "project-desktop", "#projectContent:not([hidden])");
await desktop.close();

const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
await openPage(mobile, "/index.html", "market-mobile", "#tableWrap:not([hidden])");
await openPage(mobile, "/projects.html", "projects-mobile", "#tableWrap:not([hidden])");
await mobile.close();
await browser.close();

if (consoleErrors.length) {
  console.error(consoleErrors.join("\n"));
  process.exit(1);
}
console.log("Visual smoke test completed.");
