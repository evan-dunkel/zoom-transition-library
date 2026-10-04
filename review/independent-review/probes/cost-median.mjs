// Median (of 3 runs) blocking time at the start of opening and closing, CPU slowed 4×, by group size.
import { launch, openPage, waitPhase, log } from "./lib.mjs";
const browser = await launch();
async function once(n, step) {
  const page = await openPage(browser, { scenario: "big", n }, { viewport: { width: 390, height: 800 } });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.waitForTimeout(300);
  const out = {};
  for (const s of ["open", "close"]) {
    await page.evaluate(() => { window.__lt = []; new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push(e.duration))).observe({ type: "longtask" }); });
    if (s === "open") await page.click('[data-tile="big-2"]'); else await page.keyboard.press("Escape");
    await waitPhase(page, s === "open" ? "open" : "idle", 8000);
    await page.waitForTimeout(s === "open" ? 1500 : 400); // after opening, let the cards fill in (not counted)
    out[s] = await page.evaluate(() => Math.round(Math.max(0, ...window.__lt.slice(0, 1))));
  }
  await page.context().close();
  return out;
}
const med = (a) => a.sort((x, y) => x - y)[Math.floor(a.length / 2)];
for (const n of [9, 24, 48]) {
  const runs = [];
  for (let i = 0; i < 3; i++) runs.push(await once(n));
  log(`${String(n).padStart(2)} items: open ${med(runs.map((r) => r.open))} ms, close ${med(runs.map((r) => r.close))} ms  (runs: ${runs.map((r) => r.open + "/" + r.close).join(", ")})`);
}
await browser.close();
