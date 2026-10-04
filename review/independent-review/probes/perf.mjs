// Performance: what the animation writes each frame, how long the start of open and close
// block the page, and how that grows with the size of the group.
import { launch, openPage, waitPhase, log } from "./lib.mjs";

const browser = await launch();

/** Style properties that change between frames (after the first frame), per element class. */
{
  const page = await openPage(browser, { scenario: "grid" });
  await page.evaluate(() => {
    window.__changed = {};
    const last = new WeakMap();
    let frame = 0;
    const tick = () => {
      frame++;
      document.querySelectorAll(".zoom-root *, [data-zoom-react-source]").forEach((el) => {
        const st = el.getAttribute("style") || "";
        const decl = Object.fromEntries(st.split(";").map((d) => d.split(":")).filter((d) => d[0]?.trim()).map(([k, ...v]) => [k.trim(), v.join(":").trim()]));
        const prev = last.get(el);
        if (prev && frame > 2) {
          for (const k of new Set([...Object.keys(decl), ...Object.keys(prev)])) {
            if (decl[k] !== prev[k]) {
              const who = (el.className && typeof el.className === "string" ? el.className.split(" ")[0] : el.tagName.toLowerCase()) || el.tagName.toLowerCase();
              (window.__changed[who] ??= {})[k] = ((window.__changed[who] ?? {})[k] ?? 0) + 1;
            }
          }
        }
        last.set(el, decl);
      });
      if (frame < 200) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.click('[data-tile="grid-2"]');
  await waitPhase(page, "open");
  await page.waitForTimeout(300);
  await page.keyboard.press("Escape");
  await waitPhase(page, "idle");
  log("style properties changing frame to frame during open + close (element: {property: frames}):");
  log(JSON.stringify(await page.evaluate(() => window.__changed), null, 1));
  await page.context().close();
}

/** Long tasks at the start of open and close, and frame gaps, for a group size and CPU slowdown. */
async function cost(n, throttle, viewport = { width: 1200, height: 800 }) {
  const page = await openPage(browser, { scenario: "big", n }, { viewport });
  const cdp = await page.context().newCDPSession(page);
  if (throttle > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
  await page.waitForTimeout(300);
  const res = {};
  for (const step of ["open", "close"]) {
    await page.evaluate(() => {
      window.__lt = [];
      new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push(Math.round(e.duration)))).observe({ type: "longtask" });
    });
    if (step === "open") await page.click('[data-tile="big-2"]');
    else await page.keyboard.press("Escape");
    await waitPhase(page, step === "open" ? "open" : "idle", 8000);
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => ({ lt: window.__lt, worst: Math.round(window.__zd.worst), frames: window.__zd.frames.length }));
    res[step] = `longest blocking task ${Math.max(0, ...r.lt)} ms, slowest frame ${r.worst} ms`;
  }
  log(`  group of ${String(n).padStart(2)} items, CPU ${throttle}× slower: open: ${res.open}; close: ${res.close}`);
  await page.context().close();
}
log("\nblocking work at the start of each transition (headless Chromium; 4× slowdown ≈ a mid-range phone):");
for (const n of [9, 24, 48]) await cost(n, 1);
for (const n of [9, 24, 48]) await cost(n, 4, { width: 390, height: 800 });

/** CPU profile of the start of a close, to see where the time goes. */
{
  const page = await openPage(browser, { scenario: "grid" });
  await page.click('[data-tile="grid-2"]');
  await waitPhase(page, "open");
  await page.waitForTimeout(600);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 100 });
  await cdp.send("Profiler.start");
  await page.keyboard.press("Escape");
  await waitPhase(page, "idle");
  const { profile } = await cdp.send("Profiler.stop");
  const self = new Map();
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const dt = (profile.endTime - profile.startTime) / profile.samples.length / 1000;
  profile.samples.forEach((id) => {
    const n = byId.get(id);
    const k = n.callFrame.functionName || `(${n.callFrame.url ? "anon" : n.callFrame.functionName || "native"})`;
    self.set(k, (self.get(k) ?? 0) + dt);
  });
  const top = [...self.entries()].filter(([k]) => !/idle|program/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 8);
  log("\nclose, where main-thread time goes (self time, ms; minified names):", top.map(([k, v]) => `${k} ${v.toFixed(1)}`).join(", "));
  await page.context().close();
}
await browser.close();
