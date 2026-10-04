import { launch } from "./lib.mjs";
import { pathToFileURL } from "node:url";
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto(pathToFileURL(process.cwd() + "/../demo/zoom-demo.html").href);
await page.click('[data-close="flight"]');
await page.locator("#s-portfolio iframe").scrollIntoViewIfNeeded(); await page.waitForTimeout(800);
const fr = await (await page.$('iframe[data-scenario="portfolio"]')).contentFrame();
await fr.waitForSelector("[data-tile]");
await fr.click('[data-tile="portfolio-1"] .pf-thumb');
const seen = []; for (let i = 0; i < 8; i++) { seen.push(await fr.evaluate(() => document.querySelector(".zoom-close-copy")?.style.opacity ?? "-")); await page.waitForTimeout(60); }
console.log("copy opacity during open:", seen.join(" "), "| sync attr:", await fr.evaluate(() => document.querySelector(".zoom-root").hasAttribute("data-close-sync")));
await browser.close();
