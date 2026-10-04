import { launch, PAGE_HELPERS } from "./lib.mjs";
import { pathToFileURL } from "node:url";
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
const page = await ctx.newPage();
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
await page.goto(pathToFileURL(process.cwd() + "/../demo/zoom-demo.html").href);
const frameFor = async (id) => { await page.locator(`#s-${id}`).scrollIntoViewIfNeeded(); await page.waitForTimeout(700); const fr = await (await page.$(`iframe[data-scenario="${id}"]`)).contentFrame(); await fr.waitForSelector("[data-tile]"); await fr.addScriptTag({ content: PAGE_HELPERS }); return fr; };
for (const lib of ["fixed", "original"]) {
  if (lib === "original") { await page.click('[data-lib="original"]'); await page.waitForTimeout(500); }
  const fr = await frameFor("portfolio");
  const rec = fr.evaluate(() => record("portfolio-1", 1500));
  await fr.click('[data-tile="portfolio-1"] .pf-thumb');
  const c = (await rec).filter((f) => f.clone && f.clone.w !== undefined);
  console.log(lib, "portfolio takeoff radius:", c[0]?.clone.cornerRadiusPx?.toFixed(1), "phase", await fr.evaluate(() => phase()));
  await page.locator("#s-portfolio").screenshot({ path: `shots/demo2-portfolio-${lib}.png` });
  await fr.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
  const fl = await frameFor("late");
  await fl.click('[data-tile="late-1"]'); await page.waitForTimeout(2000);
  console.log(lib, "late-1 phase after 2s:", await fl.evaluate(() => phase()));
}
// ticks + results
await page.click('[data-lib="fixed"]');
await page.locator('input[data-note="1.1"]').check();
await page.locator('input[data-note="7.2"]').check();
await page.fill('textarea[data-free="1"]', "Feels great; close button overlaps the photo.");
await page.click("#copy");
console.log("copied msg:", await page.textContent("#copied"));
console.log((await page.inputValue("#out")).split("\n").slice(0, 12).join("\n"));
await page.reload();
console.log("ticks remembered after reload:", await page.locator("input[data-note]:checked").count());
await page.screenshot({ path: "shots/demo2-top.png" });
await page.locator("#s-portfolio .scenario-text").screenshot({ path: "shots/demo2-notes.png" });
console.log("errors:", errs);
await browser.close();
