import { launch, openScenario } from "./lib.mjs";
const browser = await launch();
for (const [label, props] of [["group of 9 (default paging)", {}], ["paging off (1 card)", { paging: false }]]) {
  const page = await openScenario(browser, { scenario: "grid", props });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.evaluate(() => { window.__lt = []; new PerformanceObserver((l) => l.getEntries().forEach((e) => __lt.push(Math.round(e.duration)))).observe({ type: "longtask" }); });
  await page.click('[data-tile="grid-2"]'); await page.waitForTimeout(2500);
  console.log(label.padEnd(30), "long tasks at open (ms):", JSON.stringify(await page.evaluate(() => __lt)), "cards mounted:", await page.evaluate(() => document.querySelectorAll(".zoom-card").length));
  await page.context().close();
}
await browser.close();
