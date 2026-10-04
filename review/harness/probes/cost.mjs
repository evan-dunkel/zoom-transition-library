import { launch, openScenario } from "./lib.mjs";
const browser = await launch();
const page = await openScenario(browser, { scenario: "grid" });
const cdp = await page.context().newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await cdp.send("Profiler.enable"); await cdp.send("Profiler.start");
await page.click('[data-tile="grid-2"]'); await page.waitForTimeout(1500);
const { profile } = await cdp.send("Profiler.stop");
// self time by function name
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const self = new Map();
const dt = profile.timeDeltas; let i = 0;
for (const id of profile.samples) { const n = byId.get(id); const k = `${n.callFrame.functionName || "(anon)"}:${n.callFrame.lineNumber}`; self.set(k, (self.get(k) || 0) + (dt[i++] || 0) / 1000); }
console.log([...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${v.toFixed(1)}ms ${k}`).join("\n"));
await browser.close();
