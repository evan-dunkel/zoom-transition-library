// Shared helpers for the independent review's probes. Run probes from the repo root:
//   node review/independent-review/probes/<name>.mjs
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, "..", "..", "harness", "package.json"));
export const { chromium } = require("playwright");
export const dist = join(here, "..", "dist");
export const EXE = process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium";
export const urlFor = (cfg) => pathToFileURL(join(dist, "probe.html")).href + "?" + encodeURIComponent(JSON.stringify(cfg));

export const launch = (opts = {}) => chromium.launch({ executablePath: EXE, ...opts });
export async function openPage(browser, cfg, ctx = {}) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 800 }, ...ctx });
  const page = await context.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.goto(cfg.url ?? urlFor(cfg));
  await page.waitForSelector("[data-tile]");
  return page;
}
export const phase = (page) => page.evaluate(() => document.querySelector(".zoom-root")?.dataset.phase ?? "idle");
export const waitPhase = async (page, want, ms = 4000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if ((await phase(page)) === want) return true;
    await page.waitForTimeout(25);
  }
  return false;
};
export const rect = (page, sel) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
  }, sel);
/** What the flying copy visibly covers: its transform plus its clip-path crop, in viewport px. */
export const flyingBox = (page) =>
  page.evaluate(() => {
    const el = document.querySelector(".zoom-clone");
    if (!el) return null;
    const m = el.style.transform.match(/translate\(([-\d.e]+)px, ([-\d.e]+)px\) scale\(([-\d.e]+)\)/);
    if (!m) return null;
    const [l, t, s] = m.slice(1).map(Number);
    const W0 = parseFloat(el.style.width);
    const H0 = parseFloat(el.style.height);
    let [it, ir, ib, il] = [0, 0, 0, 0];
    const cp = el.style.clipPath.match(/inset\(([^)]*?)(?: round [^)]*)?\)/);
    if (cp) {
      const v = cp[1].trim().split(/\s+/).map(parseFloat);
      const [a, b = a, c = a, d = b] = v;
      [it, ir, ib, il] = [a, b, c, d].map((x) => Math.max(0, x));
    }
    const root = el.parentElement.getBoundingClientRect();
    return { x: Math.round(root.left + l + il * s), y: Math.round(root.top + t + it * s), w: Math.round((W0 - il - ir) * s), h: Math.round((H0 - it - ib) * s) };
  });
export const clean = (page) =>
  page.evaluate(() => ({
    phase: document.querySelector(".zoom-root")?.dataset.phase ?? "idle",
    clones: document.querySelectorAll(".zoom-clone").length,
    hidden: document.querySelectorAll("[data-zoom-hidden]").length,
    inert: document.querySelectorAll("[inert]").length,
    overflow: document.documentElement.style.overflow,
    cards: document.querySelectorAll(".zoom-card").length,
  }));
export const activeCardId = (page) => page.evaluate(() => document.querySelector(".zoom-card:not([inert])")?.dataset.zoomId ?? null);
export const focused = (page) =>
  page.evaluate(() => {
    const a = document.activeElement;
    if (!a || a === document.body) return "BODY";
    return `${a.tagName.toLowerCase()}${a.className ? "." + String(a.className).split(" ")[0] : ""}${a.getAttribute("aria-label") ? ` [${a.getAttribute("aria-label")}]` : ""}${a.dataset.tile ? ` (tile ${a.dataset.tile})` : ""}${a.closest(".zoom-root") ? " — inside the dialog" : ""}`;
  });
export const log = (...a) => console.log(...a);
