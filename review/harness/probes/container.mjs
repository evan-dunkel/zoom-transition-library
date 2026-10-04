import { launch, openScenario } from "./lib.mjs";
const browser = await launch();
for (const [scenario, id, sel, vp] of [["grid", "grid-2", '[data-tile="grid-2"]', { width: 1200, height: 800 }], ["portfolio", "portfolio-1", '[data-tile="portfolio-1"] .pf-thumb', { width: 1400, height: 900 }], ["mobile", "mobile-2", '[data-tile="mobile-2"]', { width: 390, height: 800 }]]) {
  const page = await openScenario(browser, { scenario, timeScale: 0.08, props: { closeButtonTiming: "flight" } }, { viewport: vp });
  await page.click(sel);
  for (const t of [250, 700, 1600]) { await page.waitForTimeout(t === 250 ? 250 : t === 700 ? 450 : 900); await page.screenshot({ path: `shots/ct-${scenario}-${t}.png` }); }
  console.log(scenario, "errors", page.errors, await page.evaluate((id) => ({ clip: card(id).style.clipPath.slice(0, 80), copy: !!document.querySelector(".zoom-close-copy"), copyOpacity: document.querySelector(".zoom-close-copy")?.style.opacity }), id));
  await page.context().close();
}
await browser.close();
