// Opens zoom-demo.html from disk (as a double-click would) and checks every frame works.
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { launch, log } from "./lib.mjs";
const file = pathToFileURL(join(new URL("..", import.meta.url).pathname, "zoom-demo.html")).href;
const browser = await launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("top: " + e.message));
await page.goto(file);
for (const id of ["grid", "scrolled", "phone", "reduced", "rapid", "slow", "hscroll", "big", "dupe", "throw", "scroll"]) {
  await page.locator(`#s-${id}`).scrollIntoViewIfNeeded();
  const handle = await page.waitForSelector(`iframe[data-scenario="${id}"][src]`);
  const fr = await handle.contentFrame();
  fr.on?.("pageerror", (e) => errors.push(id + ": " + e.message));
  await fr.waitForSelector("[data-tile]", { timeout: 8000 });
  const tile = id === "dupe" ? ".featured [data-tile]" : "[data-tile]";
  await fr.locator(tile).first().scrollIntoViewIfNeeded();
  await fr.click(tile);
  let p = "";
  for (let i = 0; i < 80 && p !== "open"; i++) { await page.waitForTimeout(50); p = await fr.evaluate(() => document.querySelector(".zoom-root")?.dataset.phase); }
  const reduced = await fr.evaluate(() => document.querySelector(".status")?.textContent);
  await fr.press("body", "Escape").catch(() => {});
  await fr.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
  await page.waitForTimeout(900);
  const after = await fr.evaluate(() => document.querySelector(".zoom-root")?.dataset.phase);
  log(`${id.padEnd(9)} opened: ${p === "open"}; closed: ${after === "idle"}; status: ${reduced?.replace(/\s+/g, " ").slice(0, 110)}`);
}
// Checklist + results
await page.locator("#s-grid .check").first().locator('input[value="Yes"]').check();
await page.locator("#s-grid .check").first().locator(".note").fill("looks right");
await page.locator("#env").fill("headless Chromium");
const out = await page.inputValue("#out");
log("\nresults text (first lines):\n" + out.split("\n").slice(0, 6).join("\n"));
await page.screenshot({ path: new URL("../evidence/demo-page.png", import.meta.url).pathname, fullPage: false });
log("\nerrors:", errors.length ? errors : "none");
await browser.close();
