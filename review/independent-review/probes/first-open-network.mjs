// The README's own pattern: the thumbnail and the detail photo are different files. The
// detail photo is only requested when the card opens, so on a first open it is still
// downloading while it "flies". This serves the page over a fake origin and delays the
// detail photos by a chosen latency, then reports how much of the flight showed no picture.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { launch, dist, log } from "./lib.mjs";

const browser = await launch();
const photo = (seed) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="1600" height="1000" fill="hsl(${seed * 40} 60% 60%)"/></svg>`;

for (const latency of [0, 100, 300, 1000]) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  let requests = 0;
  await context.route("http://demo.test/**", async (route) => {
    const p = new URL(route.request().url()).pathname;
    if (p === "/") return route.fulfill({ contentType: "text/html", body: readFileSync(join(dist, "probe.html"), "utf8") });
    if (p === "/app.js") return route.fulfill({ contentType: "text/javascript", body: readFileSync(join(dist, "app.js"), "utf8") });
    requests += 1;
    if (latency) await new Promise((r) => setTimeout(r, latency));
    return route.fulfill({ contentType: "image/svg+xml", body: photo(requests) });
  });
  const page = await context.newPage();
  await page.goto("http://demo.test/?" + encodeURIComponent(JSON.stringify({ scenario: "grid", heroUrl: "http://demo.test/hero" })));
  await page.waitForSelector("[data-tile]");
  const before = requests;
  const trace = page.evaluate(() => new Promise((resolve) => {
    const out = [];
    const t0 = performance.now();
    const step = (now) => {
      const clone = document.querySelector('.zoom-clone[data-zoom-id="grid-2"]');
      const imgs = clone ? [...clone.querySelectorAll("img")] : [];
      const phase = document.querySelector(".zoom-root")?.dataset.phase;
      out.push({ t: now - t0, flying: !!clone, picture: imgs.some((i) => i.complete && i.naturalWidth > 0), phase });
      if (now - t0 < 2500 && !(phase === "open" && !clone && out.length > 5)) requestAnimationFrame(step);
      else resolve(out);
    };
    requestAnimationFrame(step);
  }));
  await page.click('[data-tile="grid-2"]');
  const frames = await trace;
  const flying = frames.filter((f) => f.flying);
  const blank = flying.filter((f) => !f.picture);
  const dur = flying.length ? flying.at(-1).t - flying[0].t : 0;
  log(`latency ${String(latency).padStart(4)} ms: flight lasted ${dur.toFixed(0)} ms; frames with NO picture in the flying copy: ${blank.length}/${flying.length} (${flying.length ? Math.round((100 * blank.length) / flying.length) : 0}%); detail photos requested on open: ${requests - before}`);
  await context.close();
}
await browser.close();
