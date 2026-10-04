// Screenshots of the new presentation "scroll": opening, reading on into the next project, closing.
import { launch, openPage, waitPhase, log } from "./lib.mjs";
const out = new URL("../evidence/", import.meta.url).pathname;
const browser = await launch();
const page = await openPage(browser, { scenario: "scroll", timeScale: 0.25 }, { viewport: { width: 1200, height: 800 } });
await page.click('[data-tile="scroll-5"]');
await page.waitForTimeout(250);
await page.screenshot({ path: out + "scroll-1-opening.png" });
await waitPhase(page, "open", 8000);
await page.waitForTimeout(800);
await page.screenshot({ path: out + "scroll-2-open.png" });
// Read on: scroll the column so the next project is the one being read.
await page.evaluate(() => {
  const sc = document.querySelector(".zoom-stream");
  const c = document.querySelector('.zoom-card[data-zoom-id="scroll-6"]');
  sc.scrollTop = c.offsetTop - 300;
});
await page.waitForTimeout(1500);
await page.screenshot({ path: out + "scroll-3-next-project.png" });
const label = await page.evaluate(() => document.querySelector(".zoom-root").getAttribute("aria-label"));
await page.keyboard.press("Escape");
await page.waitForTimeout(450);
await page.screenshot({ path: out + "scroll-4-closing.png" });
await waitPhase(page, "idle", 8000);
await page.waitForTimeout(300);
await page.screenshot({ path: out + "scroll-5-closed.png" });
log("visible project after scrolling on:", label);
await browser.close();
