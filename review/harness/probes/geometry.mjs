// Does the flying hero start exactly on the source and end exactly on the hero's spot?
import { launch, openScenario } from "./lib.mjs";
const browser = await launch();
async function run(label, cfg, id, prep, ctx) {
  const page = await openScenario(browser, cfg, ctx);
  if (prep) await prep(page);
  const before = await page.evaluate((id) => ({ src: src(id), radius: getComputedStyle(document.querySelector(`[data-zoom-react-source="${id}"],[data-zoom-source="${id}"]`)).borderTopLeftRadius }), id);
  const rec = page.evaluate((id) => record(id, 2200), id);
  await page.click(`[data-tile="${id}"]`, { force: true });
  const frames = await rec;
  const withClone = frames.filter((f) => f.clone && f.clone.w !== undefined);
  const first = withClone[0];
  const last = withClone[withClone.length - 1];
  const settled = frames[frames.length - 1];
  // close
  const rec2 = page.evaluate((id) => record(id, 1600), id);
  await page.keyboard.press("Escape");
  const frames2 = await rec2;
  const cl = frames2.filter((f) => f.clone && f.clone.w !== undefined);
  const after = await page.evaluate((id) => ({ src: src(id), clean: clean() }), id);
  const d = (a, b) => a && b ? { dx: +(a.x - b.x).toFixed(1), dy: +(a.y - b.y).toFixed(1), dw: +(a.w - b.w).toFixed(1), dh: +(a.h - b.h).toFixed(1) } : null;
  console.log(`\n=== ${label}`);
  console.log(" source before open:", JSON.stringify(before));
  console.log(" OPEN first clone frame vs source:", JSON.stringify(d(first?.clone, before.src)), "clone corner radius:", first?.clone?.cornerRadiusPx, "(source radius", before.radius + ")");
  console.log(" OPEN last clone frame vs final hero:", JSON.stringify(d(last?.clone, settled.hero)), "frames w/ clone:", withClone.length, "of", frames.length);
  console.log(" CLOSE first clone vs hero:", JSON.stringify(d(cl[0]?.clone, settled.hero)), " last clone vs source-after:", JSON.stringify(d(cl[cl.length - 1]?.clone, after.src)));
  console.log(" after close:", JSON.stringify(after.clean), "errors:", page.errors);
  await page.context().close();
}
await run("grid, top of page", { scenario: "grid" }, "grid-2");
await run("scrolled page (scrollY=700)", { scenario: "scrolled" }, "scrolled-2", (p) => p.evaluate(() => scrollTo(0, 700)));
await run("scrolled page, card half under sticky header", { scenario: "scrolled" }, "scrolled-1", (p) =>
  p.evaluate(() => { const r = document.querySelector('[data-tile="scrolled-1"] .thumb').getBoundingClientRect(); scrollBy(0, r.top - 20); }));
await run("mobile 390px", { scenario: "mobile" }, "mobile-3", null, { viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });
await run("static (non-live) hero", { scenario: "grid", heroLive: false }, "grid-4");
await browser.close();
