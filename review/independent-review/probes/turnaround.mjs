// Frame-by-frame trace of one card through open → Esc → click (turn around) at ×0.1 speed.
import { launch, openPage, waitPhase, log } from "./lib.mjs";
const browser = await launch();
const page = await openPage(browser, { scenario: "rapid", timeScale: 0.1 });
const rec = page.evaluate(() => new Promise((resolve) => {
  const out = []; const t0 = performance.now();
  const step = (now) => {
    const c = document.querySelector('.zoom-card[data-zoom-id="rapid-6"]');
    const a = document.querySelector('.zoom-card[data-zoom-id="rapid-2"]');
    const r = c?.getBoundingClientRect(); const ra = a?.getBoundingClientRect();
    out.push({ t: Math.round(now - t0), ph: document.querySelector(".zoom-root").dataset.phase, x: r && Math.round(r.left), w: r && Math.round(r.width), ax: ra && Math.round(ra.left), aw: ra && Math.round(ra.width), y: r && Math.round(r.top), o: c && (+getComputedStyle(c).opacity).toFixed(2), fl: !!document.querySelector('.zoom-clone[data-zoom-id="rapid-6"]') });
    if (now - t0 < 6500) requestAnimationFrame(step); else resolve(out);
  };
  requestAnimationFrame(step);
}));
await page.click('[data-tile="rapid-2"]');
await page.waitForTimeout(2500);
await page.keyboard.press("Escape");
await page.waitForTimeout(1200);
const at = await page.evaluate(() => { const r = document.querySelector('.zoom-card[data-zoom-id="rapid-2"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 30 }; });
await page.mouse.click(at.x, at.y);
const f = await rec;
const i = f.findIndex((x, k) => k > 0 && f[k - 1].ph === "closing" && x.ph === "opening");
log("frames around the turn-around (t ms, phase, neighbour rapid-3 x/w, clicked rapid-2 x/w):");
for (const x of f.slice(i - 6, i + 40)) log(`  t${x.t} ${x.ph}  far card rapid-6 x${x.x} y${x.y} w${x.w} o${x.o} flight:${x.fl}   clicked x${x.ax} w${x.aw}`);
await browser.close();
