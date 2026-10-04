import { launch, openScenario } from "./lib.mjs";
const browser = await launch();
for (const [label, vp] of [["desktop", { width: 1400, height: 900 }], ["phone", { width: 390, height: 800 }]]) {
  const page = await openScenario(browser, { scenario: "portfolio" }, { viewport: vp });
  await page.screenshot({ path: `shots/pf-${label}-index.png` });
  const id = "portfolio-2";
  await page.evaluate((id) => document.querySelector(`[data-tile="${id}"]`).scrollIntoView({ block: "center" }), id);
  const src = await page.evaluate((id) => src(id), id);
  const rec = page.evaluate((id) => record(id, 1800), id);
  await page.click(`[data-tile="${id}"] .pf-thumb`);
  const fr = await rec;
  const c = fr.filter((f) => f.clone && f.clone.w !== undefined);
  const d = (a, b) => ({ dx: +(a.x - b.x).toFixed(1), dy: +(a.y - b.y).toFixed(1), dw: +(a.w - b.w).toFixed(1), dh: +(a.h - b.h).toFixed(1) });
  console.log(label, "takeoff vs thumb:", JSON.stringify(d(c[0].clone, src)), "radius", c[0].clone.cornerRadiusPx?.toFixed(1), "| landing vs hero:", JSON.stringify(d(c.at(-1).clone, fr.at(-1).hero)), "radius", c.at(-1).clone.cornerRadiusPx?.toFixed(1), "| card at takeoff", JSON.stringify(fr.find((f) => f.card)?.card), "op", fr.find((f) => f.card)?.cardOpacity, "zoomer", c[0] && fr[fr.indexOf(c[0])].zoomerOpacity);
  await page.screenshot({ path: `shots/pf-${label}-open.png` });
  const rec2 = page.evaluate((id) => record(id, 1500), id);
  await page.keyboard.press("Escape");
  const c2 = (await rec2).filter((f) => f.clone && f.clone.w !== undefined);
  const after = await page.evaluate((id) => src(id), id);
  console.log(label, "close landing vs thumb:", JSON.stringify(d(c2.at(-1).clone, after)), "radius", c2.at(-1).clone.cornerRadiusPx?.toFixed(1), "| errors", page.errors);
  await page.context().close();
}
// slow-mo frame mid-flight for a look
{
  const page = await openScenario(browser, { scenario: "portfolio", timeScale: 0.15 }, { viewport: { width: 1400, height: 900 } });
  await page.click('[data-tile="portfolio-1"] .pf-thumb');
  await page.waitForTimeout(450); await page.screenshot({ path: "shots/pf-mid1.png" });
  await page.waitForTimeout(900); await page.screenshot({ path: "shots/pf-mid2.png" });
  await page.context().close();
}
await browser.close();
