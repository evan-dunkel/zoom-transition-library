import { launch, openScenario } from "./lib.mjs";
import { pathToFileURL } from "node:url";
const browser = await launch();
async function measure(label, cfg, tile, { throttle = 1, ctx = {}, url } = {}) {
  const page = await openScenario(browser, url ? { url } : cfg, ctx);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  if (throttle > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
  await page.waitForTimeout(300);
  const metrics = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
  const out = {};
  for (const phaseName of ["open", "close"]) {
    await page.evaluate(() => { window.__ft = []; window.__lt = []; let last = performance.now(); window.__stop = false; const f = (t) => { __ft.push(t - last); last = t; if (!__stop) requestAnimationFrame(f); }; requestAnimationFrame(f); new PerformanceObserver((l) => l.getEntries().forEach((e) => __lt.push(e.duration))).observe({ type: "longtask" }); });
    const m0 = await metrics();
    if (phaseName === "open") await page.click(`[data-tile="${tile}"]`); else await page.keyboard.press("Escape");
    await page.waitForTimeout(1500 * Math.max(1, throttle / 2));
    const m1 = await metrics();
    const fr = await page.evaluate(() => { __stop = true; return { ft: __ft.slice(1), lt: __lt }; });
    const ft = fr.ft.slice(0, 40).sort((a, b) => a - b);
    out[phaseName] = {
      layouts: m1.LayoutCount - m0.LayoutCount,
      styleRecalcs: m1.RecalcStyleCount - m0.RecalcStyleCount,
      layoutMs: +((m1.LayoutDuration - m0.LayoutDuration) * 1000).toFixed(1),
      scriptMs: +((m1.ScriptDuration - m0.ScriptDuration) * 1000).toFixed(1),
      medianFrameMs: +ft[Math.floor(ft.length / 2)].toFixed(1),
      worstFrameMs: +ft.at(-1).toFixed(1),
      framesOver20ms: ft.filter((x) => x > 20).length + "/" + ft.length,
      longTasks: fr.lt.map((x) => Math.round(x)),
    };
  }
  console.log(`\n${label}${throttle > 1 ? ` (CPU ${throttle}x slower)` : ""}`);
  for (const [k, v] of Object.entries(out)) console.log(`  ${k.padEnd(5)}`, JSON.stringify(v));
  await page.context().close();
}
await measure("grid, live hero (default)", { scenario: "grid" }, "grid-2");
await measure("grid, live hero", { scenario: "grid" }, "grid-2", { throttle: 4 });
await measure("grid, static hero (live={false})", { scenario: "grid", heroLive: false }, "grid-2", { throttle: 4 });
await measure("mobile 390px", { scenario: "mobile" }, "mobile-2", { throttle: 4, ctx: { viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 } });
await measure("plain-HTML template path (scan + TemplateDestination)", null, "t-2", { throttle: 4, url: pathToFileURL(process.cwd() + "/dist/template.html").href });
// what does the animation write? check which CSS properties change on animated elements
{
  const page = await openScenario(browser, { scenario: "grid" });
  await page.evaluate(() => {
    window.__props = new Set();
    new MutationObserver((ms) => ms.forEach((m) => { const st = m.target.getAttribute("style") || ""; st.split(";").map((d) => d.split(":")[0].trim()).filter(Boolean).forEach((p) => __props.add(p)); })).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["style"] });
  });
  await page.click('[data-tile="grid-2"]'); await page.waitForTimeout(1200); await page.keyboard.press("Escape"); await page.waitForTimeout(1200);
  console.log("\nstyle properties written during open+close:", [...await page.evaluate(() => [...__props])].join(", "));
  // template XSS
  await page.context().close();
}
{
  const page = await openScenario(browser, { url: pathToFileURL(process.cwd() + "/dist/template.html").href });
  console.log("\nTEMPLATE: onerror ran before opening?", await page.evaluate(() => window.__xss ?? 0));
  await page.click('[data-tile="t-2"]'); await page.waitForTimeout(1500);
  console.log("TEMPLATE: onerror ran after opening card t-2:", await page.evaluate(() => window.__xss ?? 0), "times; errors:", page.errors.filter((e) => !/x-missing|ERR_FILE/.test(e)));
  const geo = await page.evaluate(() => ({ phase: phase() }));
  console.log("TEMPLATE path phase:", geo.phase);
  await page.context().close();
}
await browser.close();
