import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

export const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
export const dist = join(process.cwd(), "dist");
export const urlFor = (cfg) => pathToFileURL(join(dist, "test.html")).href + "?" + encodeURIComponent(JSON.stringify(cfg));

export async function launch(opts = {}) {
  return chromium.launch({ executablePath: EXE, ...opts });
}
export async function openScenario(browser, cfg, ctxOpts = {}) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 800 }, ...ctxOpts });
  const page = await context.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && page.errors.push(m.text()));
  await page.goto(cfg.url ?? urlFor(cfg));
  await page.addScriptTag({ content: PAGE_HELPERS });
  return page;
}

// Helpers installed in the page.
export const PAGE_HELPERS = `
window.R = (r) => r && ({ x: +r.left.toFixed(1), y: +r.top.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) });
/** What the flying copy visibly covers (its transform + clip-path crop), in viewport px. */
window.cloneVisible = (el = document.querySelector('.zoom-clone')) => {
  if (!el) return null;
  const m = el.style.transform.match(/translate\\(([-\\d.e]+)px, ([-\\d.e]+)px\\) scale\\(([-\\d.e]+|Infinity|NaN)\\)/);
  if (!m) return { raw: el.style.transform };
  const [l, t, s] = m.slice(1).map(Number);
  const W0 = parseFloat(el.style.width), H0 = parseFloat(el.style.height);
  let it = 0, ir = 0, ib = 0, il = 0, round = 0;
  const cp = el.style.clipPath.match(/inset\\(([^)]*?)(?: round ([-\\d.e]+)px)?\\)/);
  if (cp) {
    const v = cp[1].trim().split(/\\s+/).map(parseFloat);
    const [a, b = a, c = a, d = b] = v;
    [it, ir, ib, il] = [a, b, c, d].map((x) => Math.max(0, x));
    round = cp[2] ? +cp[2] * s : 0;
  }
  const root = el.parentElement.getBoundingClientRect();
  const f = (v) => +v.toFixed(1);
  return { x: f(root.left + l + il * s), y: f(root.top + t + it * s), w: f((W0 - il - ir) * s), h: f((H0 - it - ib) * s), s, W0, H0, cornerRadiusPx: round, clipPath: el.style.clipPath };
};
window.src = (id) => R(document.querySelector('[data-zoom-react-source="' + id + '"],[data-zoom-source="' + id + '"]').getBoundingClientRect());
window.card = (id) => document.querySelector('.zoom-card[data-zoom-id="' + id + '"]');
window.phase = () => document.querySelector('.zoom-root')?.dataset.phase ?? 'idle';
/** Record every animation frame until the phase settles (or ms passes). */
window.record = (id, ms = 3000) => new Promise((resolve) => {
  const frames = []; const t0 = performance.now();
  const step = (now) => {
    const c = card(id);
    const hero = c?.querySelector('[data-zoom-hero]');
    frames.push({ t: +(now - t0).toFixed(1), phase: phase(), clone: cloneVisible(document.querySelector('.zoom-clone[data-zoom-id="' + id + '"]')), card: c && R(c.getBoundingClientRect()), cardOpacity: c && getComputedStyle(c).opacity, zoomerOpacity: getComputedStyle(document.querySelector('.zoom-zoomer')).opacity, hero: hero && R(hero.getBoundingClientRect()), heroVis: hero && getComputedStyle(hero).visibility });
    if (now - t0 < ms) requestAnimationFrame(step); else resolve(frames);
  };
  requestAnimationFrame(step);
});
window.clean = () => ({ phase: phase(), clones: document.querySelectorAll('.zoom-clone').length, hidden: document.querySelectorAll('[data-zoom-hidden]').length, dimmed: document.querySelectorAll('[data-zoom-dimmed]').length, htmlOverflow: document.documentElement.style.overflow, gutter: document.documentElement.style.scrollbarGutter, cards: document.querySelectorAll('.zoom-card').length, live: document.querySelectorAll('.zoom-live').length, inert: document.querySelectorAll('[inert]').length });
`;
