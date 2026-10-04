import { launch } from "./lib.mjs";
import { pathToFileURL } from "node:url";
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto("data:text/html,<p>previous site</p>");
await page.goto(pathToFileURL(process.cwd() + "/../demo/zoom-demo.html").href);
await page.locator("#s-rapid").scrollIntoViewIfNeeded(); await page.waitForTimeout(800);
const fr = await (await page.$('iframe[data-scenario="rapid"]')).contentFrame();
await fr.waitForSelector(".tester-buttons button");
for (const name of ["Open, then browser Back halfway", "Double-click a card", "Chaos: 25 random actions", "Close, then tap the card as it flies home"]) {
  await fr.evaluate((n) => [...document.querySelectorAll(".tester-buttons button")].find((b) => b.textContent === n).click(), name);
  await fr.waitForFunction(() => /finished/.test(document.querySelector(".tester-log").textContent), null, { timeout: 30000 });
  console.log(name.padEnd(42), await fr.evaluate(() => document.querySelector(".tester-log").textContent.replace(/^.*finished\. /, "")));
  if (await fr.evaluate(() => document.querySelector(".zoom-root").dataset.phase === "open")) { await fr.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))); await page.waitForTimeout(1200); }
}
console.log("main page still demo:", page.url().endsWith("zoom-demo.html"));
await page.locator("#s-rapid").screenshot({ path: "shots/demo-rapid.png" });
await browser.close();
