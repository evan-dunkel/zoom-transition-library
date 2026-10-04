// Screenshots of the first moments of an opening, slowed 4x, to see what the rest of the page does.
import { launch, openPage, log } from "./lib.mjs";
const out = new URL("../evidence/", import.meta.url).pathname;
const browser = await launch();
const page = await openPage(browser, { scenario: "grid", timeScale: 0.25 });
await page.click('[data-tile="grid-2"]');
for (const ms of [30, 150, 450]) {
  await page.waitForTimeout(ms === 30 ? 30 : ms - (ms === 150 ? 30 : 150));
  await page.screenshot({ path: `${out}takeoff-${ms}ms.png` });
}
const hidden = await page.evaluate(() => document.querySelectorAll("[data-zoom-hidden]").length);
log("thumbnails hidden during opening:", hidden);
await browser.close();
