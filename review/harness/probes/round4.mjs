import { launch, openScenario, urlFor } from "./lib.mjs";
const browser = await launch();
/** Mean per-channel difference (0-255) between two PNG screenshots, computed in the page. */
const diff = (page, a, b) => page.evaluate(async ([a, b]) => {
  const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = "data:image/png;base64," + s; });
  const [A, B] = await Promise.all([load(a), load(b)]);
  const px = (img) => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d"); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
  const da = px(A), db = px(B); let sum = 0;
  for (let i = 0; i < da.length; i += 4) sum += Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
  return +(sum / (da.length / 4) / 3).toFixed(2);
}, [a.toString("base64"), b.toString("base64")]);

async function takeoff(label, cfg, id, thumbSel) {
  const page = await openScenario(browser, { ...cfg, timeScale: 0.02 }, { viewport: { width: 1400, height: 900 } });
  const r = await page.evaluate((id) => src(id), id);
  const clip = { x: r.x + 2, y: r.y + 2, width: r.w - 4, height: r.h - 4 };
  const before = await page.screenshot({ clip });
  await page.click(thumbSel);
  await page.waitForTimeout(60);
  const after = await page.screenshot({ clip });
  const c = await page.evaluate((id) => { const el = document.querySelector('.zoom-clone[data-zoom-id="' + id + '"]'); return el && { box: el.style.width + "x" + el.style.height, fill: "zoomFill" in el.dataset }; }, id);
  console.log(`${label}: take-off frame vs thumbnail, mean pixel difference = ${await diff(page, before, after)} (0 = identical) | flying box ${c?.box} fill=${c?.fill}`);
  await page.context().close();
}
await takeoff("grid FIXED (4:3 thumb -> 16:10 hero)", { scenario: "grid" }, "grid-2", '[data-tile="grid-2"]');
await takeoff("grid ORIGINAL", { scenario: "grid", url: urlFor({ scenario: "grid", timeScale: 0.02 }).replace("test.html", "test-original.html") }, "grid-2", '[data-tile="grid-2"]');
await takeoff("phone list FIXED (square -> 16:10)", { scenario: "mobile" }, "mobile-2", '[data-tile="mobile-2"]');
await takeoff("portfolio FIXED (3:2 -> 3:2)", { scenario: "portfolio" }, "portfolio-1", '[data-tile="portfolio-1"] .pf-thumb');

// landing: last frames vs final, and close end vs thumbnail
{
  const page = await openScenario(browser, { scenario: "grid" });
  const before = await page.evaluate(() => src("grid-2"));
  const rec = page.evaluate(() => record("grid-2", 1800));
  await page.click('[data-tile="grid-2"]');
  const fr = (await rec).filter((f) => f.clone && f.clone.w !== undefined);
  const hero = await page.evaluate(() => R(card("grid-2").querySelector("[data-zoom-hero]").getBoundingClientRect()));
  console.log("grid geometry: first", JSON.stringify(fr[0].clone && { x: fr[0].clone.x, y: fr[0].clone.y, w: fr[0].clone.w, h: fr[0].clone.h }), "src", JSON.stringify(before), "| last", JSON.stringify({ x: fr.at(-1).clone.x, y: fr.at(-1).clone.y, w: fr.at(-1).clone.w, h: fr.at(-1).clone.h }), "hero", JSON.stringify(hero));
  // close-end visual: screenshot thumb region right after landing vs before
  await page.context().close();
}
// gaps: horizontal, vertical, stream
for (const [label, props, vp] of [["horizontal", {}, { width: 1400, height: 900 }], ["vertical", { orientation: "vertical" }, { width: 1400, height: 900 }], ["stream", { layout: "stream" }, { width: 1400, height: 900 }]]) {
  const page = await openScenario(browser, { scenario: "grid", props }, { viewport: vp });
  await page.click('[data-tile="grid-2"]'); await page.waitForTimeout(1300);
  const g = await page.evaluate(() => { const a = card("grid-2").getBoundingClientRect(); const b = card("grid-3").getBoundingClientRect(); return { a: R(a), b: R(b) }; });
  const vertical = label !== "horizontal";
  const gx = vertical ? g.a.x + g.a.w / 2 : (g.a.x + g.a.w + g.b.x) / 2;
  const gy = vertical ? (g.a.y + g.a.h + g.b.y) / 2 : g.a.y + g.a.h / 2;
  await page.mouse.click(gx, gy); await page.waitForTimeout(800);
  const afterGap = await page.evaluate(() => phase());
  // empty space beside the card (vertical/stream) or above it (horizontal)
  const ex = vertical ? Math.max(5, g.a.x - 40) : g.a.x + 100, ey = vertical ? g.a.y + 100 : Math.max(3, g.a.y - 10);
  await page.mouse.click(ex, ey); await page.waitForTimeout(900);
  console.log(`GAP ${label}: gap ${Math.round(vertical ? g.b.y - g.a.y - g.a.h : g.b.x - g.a.x - g.a.w)}px -> ${afterGap}; empty space -> ${await page.evaluate(() => phase())}`);
  await page.context().close();
}
// resize mid-open: finishes at once, no motion afterwards
{
  const page = await openScenario(browser, { scenario: "grid" });
  const rec = page.evaluate(() => record("grid-1", 1500));
  await page.click('[data-tile="grid-1"]');
  await page.waitForTimeout(150);
  await page.setViewportSize({ width: 600, height: 800 });
  const fr = (await rec).filter((f) => f.card);
  const k = fr.findIndex((f) => f.phase === "open");
  const moves = fr.slice(k + 1).filter((f, i) => Math.abs(f.card.w - fr[k + i].card.w) + Math.abs(f.card.x - fr[k + i].card.x) > 0.5).length;
  console.log(`RESIZE mid-open: open ${Math.round(fr[k].t - fr[0].t)}ms after first frame; frames that moved afterwards: ${moves}; final ${JSON.stringify(fr.at(-1).card)}; clones ${await page.evaluate(() => clean().clones)} errors ${page.errors}`);
  await page.context().close();
}
{
  const page = await openScenario(browser, { scenario: "grid" });
  await page.click('[data-tile="grid-1"]'); await page.waitForTimeout(1300);
  const rec = page.evaluate(() => record("grid-1", 1200));
  await page.keyboard.press("Escape"); await page.waitForTimeout(100);
  await page.setViewportSize({ width: 700, height: 800 });
  await rec;
  console.log("RESIZE mid-close:", JSON.stringify(await page.evaluate(() => clean())));
  await page.context().close();
}
await browser.close();
