// The served demo on an emulated phone (touch, 390 px): stages load, a tap opens.
import { launch, PAGE_HELPERS } from "./lib.mjs";
import { spawn } from "node:child_process";
const srv = spawn("node", ["serve.mjs"], { env: { ...process.env, PORT: "5198" } });
await new Promise((r) => setTimeout(r, 800));
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" });
const page = await ctx.newPage();
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
await page.goto("http://127.0.0.1:5198/");
for (const id of ["portfolio", "mobile"]) {
  await page.locator(`#s-${id}`).scrollIntoViewIfNeeded(); await page.locator(`iframe[data-scenario="${id}"]`).scrollIntoViewIfNeeded(); await page.waitForTimeout(900);
  const fr = await (await page.$(`iframe[data-scenario="${id}"]`)).contentFrame();
  await fr.waitForSelector("[data-tile]", { timeout: 8000 });
  await fr.addScriptTag({ content: PAGE_HELPERS });
  const tile = id === "portfolio" ? '[data-tile="portfolio-1"] .pf-thumb' : '[data-tile="mobile-2"]';
  await fr.tap(tile); await page.waitForTimeout(1300);
  console.log(id, "stage loaded; after tap:", await fr.evaluate(() => phase()));
}
await page.screenshot({ path: "shots/phone-served.png" });
console.log("results box present:", await page.locator("#out").count(), "| errors:", errs);
await browser.close(); srv.kill();
