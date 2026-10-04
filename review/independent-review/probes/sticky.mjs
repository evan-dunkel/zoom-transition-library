// A thumbnail half under a sticky header: what happens at take-off and at landing.
import { launch, openPage, waitPhase, rect, flyingBox, log } from "./lib.mjs";
const out = new URL("../evidence/", import.meta.url).pathname;
const browser = await launch();
const page = await openPage(browser, { scenario: "scrolled", timeScale: 0.2 });
await page.evaluate(() => {
  const t = document.querySelector('[data-tile="scrolled-2"] .thumb').getBoundingClientRect();
  scrollBy(0, t.top - 60 + t.height / 2); // header is 60px tall: put half the thumbnail under it
});
await page.waitForTimeout(200);
const src = await rect(page, '[data-tile="scrolled-2"] .thumb');
await page.screenshot({ path: out + "sticky-before.png", clip: { x: 0, y: 0, width: 1200, height: 360 } });
await page.click('[data-tile="scrolled-2"] .tile-title');
await page.waitForTimeout(30);
const fb = await flyingBox(page);
await page.screenshot({ path: out + "sticky-takeoff.png", clip: { x: 0, y: 0, width: 1200, height: 360 } });
log(`thumbnail ${JSON.stringify(src)} (top 60px hidden under the header is ${Math.max(0, 60 - src.y)}px of it); flying copy at take-off ${JSON.stringify(fb)}`);
await browser.close();
