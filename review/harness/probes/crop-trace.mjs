// Per-frame trace of the flying image: the whole picture's box on screen and the visible window.
import { launch, openScenario } from "./lib.mjs";
const browser = await launch();
for (const [scenario, id, vp] of [["grid", "grid-2", { width: 1200, height: 800 }], ["portfolio", "portfolio-2", { width: 1400, height: 900 }]]) {
  const page = await openScenario(browser, { scenario }, { viewport: vp });
  await page.evaluate((id) => document.querySelector(`[data-tile="${id}"]`).scrollIntoView({ block: "center" }), id);
  const traceFn = (id) => new Promise((resolve) => {
    const out = []; const t0 = performance.now();
    const step = (now) => {
      const el = document.querySelector(`.zoom-clone[data-zoom-id="${id}"]`);
      const hero = document.querySelector(`.zoom-card[data-zoom-id="${id}"] [data-zoom-hero]`);
      if (el) {
        const m = el.style.transform.match(/translate\(([-\d.e]+)px, ([-\d.e]+)px\) scale\(([-\d.e]+)\)/);
        const [l, t, s] = m.slice(1).map(Number);
        const v = cloneVisible(el);
        // what the picture inside actually renders as (svg/img box on screen)
        const media = el.querySelector(".zoom-live svg, .zoom-live img") || el.querySelector("svg, img");
        const mr = media.getBoundingClientRect();
        out.push({ t: +(now - t0).toFixed(0), s: +s.toFixed(3), pic: [mr.left, mr.top, mr.width, mr.height].map((x) => +x.toFixed(1)), vis: [v.x, v.y, v.w, v.h], aspect: +(v.w / v.h).toFixed(3) });
      } else if (out.length && !out.at(-1).end) {
        const src = document.querySelector(`[data-tile="${id}"] [data-zoom-react-source] svg`);
        if (!hero && src) { const r = src.getBoundingClientRect(); out.push({ end: true, t: +(now - t0).toFixed(0), thumbPic: [r.left, r.top, r.width, r.height].map((x) => +x.toFixed(1)) }); }
        if (!hero) { requestAnimationFrame(step); return; }
        const hr = hero.getBoundingClientRect(); const media = hero.querySelector("svg, img").getBoundingClientRect();
        out.push({ end: true, t: +(now - t0).toFixed(0), heroPic: [media.left, media.top, media.width, media.height].map((x) => +x.toFixed(1)), heroVis: [hr.left, hr.top, hr.width, hr.height].map((x) => +x.toFixed(1)) });
      }
      if (now - t0 < 1600) requestAnimationFrame(step); else resolve(out);
    };
    requestAnimationFrame(step);
  });
  globalThis.TRACE_FN_SRC = traceFn;
  const trace = page.evaluate(traceFn, id);
  const thumb = await page.evaluate((id) => { const s = document.querySelector(`[data-tile="${id}"] [data-zoom-react-source]`); const m = s.querySelector("svg"); return { vis: R(s.getBoundingClientRect()), pic: R(m.getBoundingClientRect()) }; }, id);
  await page.click(`[data-tile="${id}"] ${scenario === "portfolio" ? ".pf-thumb" : ".thumb"}`);
  let tr = await trace;
  if (process.argv.includes("--close")) {
    const t2 = page.evaluate(traceFn, id);
    await page.keyboard.press("Escape");
    tr = await t2;
  }
  console.log(`\n== ${scenario}: thumbnail svg box ${JSON.stringify(thumb.pic)} visible ${JSON.stringify(thumb.vis)}`);
  for (const f of tr.slice(0, 6).concat(["…"], tr.slice(-4))) console.log(typeof f === "string" ? f : JSON.stringify(f));
  await page.context().close();
}
await browser.close();
