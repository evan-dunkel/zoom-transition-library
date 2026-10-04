// Follow-ups from the designer's third set of results: the slow photo after landing, and a card's
// address opened in a new tab and reloaded (from the double-click demo file itself).
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { launch, openPage, waitPhase, log } from "./lib.mjs";
const out = new URL("../evidence/", import.meta.url).pathname;
const browser = await launch();
{
  const page = await openPage(browser, { scenario: "slow", slowMs: 2500 });
  await page.click('[data-tile="slow-2"]');
  await waitPhase(page, "open");
  await page.waitForTimeout(150);
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector('.zoom-card[data-zoom-id="slow-2"] [data-zoom-hero] img')).backgroundImage.slice(0, 30));
  const nb = await page.evaluate(() => getComputedStyle(document.querySelector('.zoom-card[data-zoom-id="slow-3"] [data-zoom-hero] img')).backgroundImage.slice(0, 30));
  await page.screenshot({ path: out + "slow-after-landing.png" });
  log(`slow photo, just after landing: opened card's photo background = ${bg}…; neighbour's = ${nb}…`);
  await page.waitForTimeout(2600);
  log(`after the photo arrived: ${await page.evaluate(() => getComputedStyle(document.querySelector('.zoom-card[data-zoom-id="slow-2"] [data-zoom-hero] img')).backgroundImage)}`);
  await page.context().close();
}
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const demo = await context.newPage();
  await demo.goto(pathToFileURL(join(new URL("..", import.meta.url).pathname, "zoom-demo.html")).href);
  await demo.locator("#s-rapid").scrollIntoViewIfNeeded();
  const [tab] = await Promise.all([context.waitForEvent("page"), demo.click('[data-window="rapid"]')]);
  await tab.waitForSelector("[data-tile]");
  await tab.click('[data-tile="rapid-1"]');
  await waitPhase(tab, "open");
  const address = tab.url();
  await tab.reload();
  await tab.waitForSelector("[data-tile]");
  await tab.waitForTimeout(600);
  const reopened = await tab.evaluate(() => document.querySelector(".zoom-root")?.dataset.phase);
  await tab.keyboard.press("Escape");
  await waitPhase(tab, "idle");
  log(`new tab: address while open …${address.slice(address.indexOf("#"))}; after reload the card is ${reopened}; after Esc the address is …${tab.url().slice(-12)}`);
  // A card link opened straight into a new tab (Cmd/Ctrl-click): its href is the same address.
  const href = await tab.evaluate(() => document.querySelector('[data-tile="rapid-2"]').getAttribute("href"));
  const linked = await context.newPage();
  await linked.goto(tab.url().split("#")[0] + href);
  await linked.waitForSelector("[data-tile]");
  await linked.waitForTimeout(600);
  log(`a card link (${href}) opened in a new tab: card is ${await linked.evaluate(() => document.querySelector(".zoom-root")?.dataset.phase)}`);
  await context.close();
}
await browser.close();
