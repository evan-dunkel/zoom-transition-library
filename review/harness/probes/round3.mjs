import { launch, openScenario } from "./lib.mjs";
const browser = await launch();
const pick = (frames, n) => { const c = frames.filter((f) => f.clone && f.clone.w !== undefined); const idx = [0, 1, 3, 6, 10, 15, 22, 30, c.length - 2, c.length - 1].filter((i) => i >= 0 && i < c.length); return idx.map((i) => `t${Math.round(c[i].t)} r=[${c[i].clone.radii}] src=${c[i].clone.srcOpacity?.toFixed(2)}`).join("\n   "); };
// corners + dissolve, grid (edge-to-edge hero inside a 28px-round card)
{
  const page = await openScenario(browser, { scenario: "grid" });
  const rec = page.evaluate(() => record("grid-2", 1600));
  await page.click('[data-tile="grid-2"]');
  const fr = await rec;
  console.log("GRID OPEN frames:\n  ", pick(fr));
  console.log("  card corner radius:", await page.evaluate(() => getComputedStyle(card("grid-2")).borderTopLeftRadius));
  console.log("  close button opacity over time:", [...new Set(fr.map((f) => f.closeOpacity))].slice(0, 8).join(" → "));
  const rec2 = page.evaluate(() => record("grid-2", 1400));
  await page.keyboard.press("Escape");
  console.log("GRID CLOSE frames:\n  ", pick(await rec2));
  await page.context().close();
}
// quiet focus: mouse open + Esc vs keyboard open + Esc
for (const how of ["mouse", "keyboard"]) {
  const page = await openScenario(browser, { scenario: "portfolio" }, { viewport: { width: 1400, height: 900 } });
  if (how === "mouse") await page.click('[data-tile="portfolio-1"] .pf-thumb');
  else { await page.focus('[data-tile="portfolio-1"]'); await page.keyboard.press("Enter"); }
  await page.waitForTimeout(1200);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1000);
  const st = () => page.evaluate(() => { const a = document.activeElement; return `${a.dataset.tile} focusVisible=${a.matches(":focus-visible")} outline=${getComputedStyle(a).outlineStyle} quiet=${a.hasAttribute("data-zoom-quiet-focus")}`; });
  console.log(`FOCUS after ${how} open + Esc:`, await st());
  await page.keyboard.press("Tab");
  console.log("   then Tab:", await page.evaluate(() => { const a = document.activeElement; return `${a.dataset.tile} outline=${getComputedStyle(a).outlineStyle}`; }));
  await page.context().close();
}
// empty-space click and neighbour click
{
  const page = await openScenario(browser, { scenario: "portfolio" }, { viewport: { width: 1400, height: 900 } });
  await page.click('[data-tile="portfolio-1"] .pf-thumb'); await page.waitForTimeout(1200);
  const r = await page.evaluate(() => R(card("portfolio-1").getBoundingClientRect()));
  await page.mouse.click(r.x - 60, 400); // left of the first card: empty
  await page.waitForTimeout(900);
  console.log("CLICK empty space left of first card ->", await page.evaluate(() => phase()));
  await page.click('[data-tile="portfolio-3"] .pf-thumb'); await page.waitForTimeout(1200);
  const r3 = await page.evaluate(() => R(card("portfolio-3").getBoundingClientRect()));
  await page.mouse.click(r3.x + r3.w + 40, 400); // the neighbour peeking on the right
  await page.waitForTimeout(900);
  console.log("CLICK neighbour on the right ->", await page.evaluate(() => `${phase()} visible=${document.querySelector(".zoom-card:not([inert])")?.dataset.zoomId}`));
  await page.mouse.click(r3.x + 200, r3.y + r3.h + 8); // just below the card
  await page.waitForTimeout(900);
  console.log("CLICK below the card ->", await page.evaluate(() => phase()));
  await page.context().close();
}
// resize during opening: is there a jump after it opens?
{
  const page = await openScenario(browser, { scenario: "grid" });
  const rec = page.evaluate(() => record("grid-1", 2200));
  await page.click('[data-tile="grid-1"]');
  await page.waitForTimeout(150);
  await page.setViewportSize({ width: 600, height: 800 });
  const fr = await rec;
  const steps = fr.filter((f) => f.card).map((f, i, a) => ({ t: f.t, ph: f.phase, w: f.card.w, x: f.card.x, jump: i ? Math.round(Math.abs(f.card.w - a[i - 1].card.w) + Math.abs(f.card.x - a[i - 1].card.x)) : 0 }));
  const openIdx = steps.findIndex((s) => s.ph === "open");
  console.log("RESIZE mid-open: biggest frame-to-frame jump while opening:", Math.max(...steps.slice(0, openIdx).map((s) => s.jump)), "| jump at the moment it becomes open:", steps[openIdx]?.jump, "| after open:", Math.max(0, ...steps.slice(openIdx + 1).map((s) => s.jump)), "| final", JSON.stringify(steps.at(-1)), "| errors", page.errors);
  await page.context().close();
}
await browser.close();
