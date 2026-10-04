// Closing the scroll presentation while reading far down a long case study, frame by frame.
import { launch, openPage, waitPhase } from "./lib.mjs";
const out = new URL("../evidence/", import.meta.url).pathname;
const browser = await launch();
const page = await openPage(browser, { scenario: "scroll", timeScale: 0.25 }, { viewport: { width: 1200, height: 800 } });
await page.click('[data-tile="scroll-5"]');
await waitPhase(page, "open", 8000);
await page.waitForTimeout(1500);
await page.evaluate(() => { document.querySelector(".zoom-stream").scrollTop += 1400; });
await page.waitForTimeout(600);
await page.screenshot({ path: out + "scroll-close-0.png" });
await page.keyboard.press("Escape");
for (const ms of [150, 350, 600, 900]) { await page.waitForTimeout(ms === 150 ? 150 : ms === 350 ? 200 : ms === 600 ? 250 : 300); await page.screenshot({ path: out + `scroll-close-${ms}.png` }); }
await waitPhase(page, "idle", 8000);
await browser.close();
