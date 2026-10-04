import { launch, openScenario } from "./lib.mjs";
const browser = await launch();
// 1) corner pop at take-off, grid
{
  const page = await openScenario(browser, { scenario: "grid", timeScale: 0.02 });
  const r = await page.evaluate(() => src("grid-2"));
  const clip = { x: r.x - 20, y: r.y - 20, width: r.w + 40, height: r.h + 40 };
  await page.screenshot({ path: "shots/corner-before.png", clip });
  await page.click('[data-tile="grid-2"]');
  await page.waitForTimeout(60);
  await page.screenshot({ path: "shots/corner-takeoff.png", clip });
  await page.context().close();
}
// 2) sticky header: card half under the header
{
  const page = await openScenario(browser, { scenario: "scrolled", timeScale: 0.02 });
  await page.evaluate(() => { const r = document.querySelector('[data-tile="scrolled-1"] .thumb').getBoundingClientRect(); scrollBy(0, r.top - 20); });
  const clip = { x: 0, y: 0, width: 700, height: 260 };
  await page.screenshot({ path: "shots/sticky-before.png", clip });
  await page.click('[data-tile="scrolled-1"]', { position: { x: 100, y: 150 } });
  await page.waitForTimeout(60);
  await page.screenshot({ path: "shots/sticky-takeoff.png", clip });
  await page.context().close();
}
await browser.close();
