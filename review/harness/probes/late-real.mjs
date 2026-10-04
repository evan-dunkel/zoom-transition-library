import { launch, PAGE_HELPERS } from "./lib.mjs";
import { readFileSync } from "node:fs";
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const page = await ctx.newPage();
const svg = readFileSync("dist/test.html", "utf8");
await ctx.route("http://demo.test/**", async (route) => {
  const u = new URL(route.request().url());
  if (u.pathname === "/" ) return route.fulfill({ contentType: "text/html", body: readFileSync("dist/test.html", "utf8") });
  if (u.pathname === "/app.js") return route.fulfill({ contentType: "text/javascript", body: readFileSync("dist/app.js", "utf8") });
  if (u.pathname.startsWith("/img/")) {
    await new Promise((r) => setTimeout(r, 900)); // slow network
    return route.fulfill({ contentType: "image/svg+xml", body: `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="1600" height="1000" fill="#7aa"/></svg>` });
  }
  route.fulfill({ status: 404, body: "" });
});
await page.goto("http://demo.test/?" + encodeURIComponent(JSON.stringify({ scenario: "late", lateUrl: "http://demo.test/img" })));
await page.addScriptTag({ content: PAGE_HELPERS });
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
const rec = page.evaluate(() => record("late-2", 2200));
await page.click('[data-tile="late-2"]');
const frames = await rec;
const c = frames.filter((f) => f.clone);
console.log("first clone:", JSON.stringify(c[0]?.clone));
console.log("hero sizes seen:", JSON.stringify([...new Set(frames.map((f) => f.hero && `${f.hero.w}x${f.hero.h}`))].slice(0, 6)));
console.log("clone frames:", c.length, "end phase:", frames.at(-1).phase, "errors:", errs);
await page.waitForTimeout(3000);
console.log("5s after click:", JSON.stringify(await page.evaluate(() => ({ phase: phase(), heroVisibility: getComputedStyle(card("late-2").querySelector("[data-zoom-hero]")).visibility, heroBox: R(card("late-2").querySelector("[data-zoom-hero]").getBoundingClientRect()), focus: document.activeElement?.className, clones: document.querySelectorAll(".zoom-clone").length, cloneTransform: document.querySelector(".zoom-clone")?.style.transform }))));
await page.screenshot({ path: "shots/late-real-stuck.png" });
// can the person still get out? try a drag-down dismiss (needs phase "open"), then Escape
await page.mouse.move(600, 300); await page.mouse.down(); await page.mouse.move(600, 360, { steps: 5 }); await page.mouse.move(600, 600, { steps: 10 }); await page.mouse.up();
await page.waitForTimeout(800);
console.log("after drag-to-dismiss attempt:", await page.evaluate(() => phase()));
await page.keyboard.press("Escape");
await page.waitForTimeout(1500);
console.log("after Escape:", JSON.stringify(await page.evaluate(() => clean())));
await page.waitForTimeout(8000);
console.log("10s after Escape:", JSON.stringify(await page.evaluate(() => clean())));
await page.screenshot({ path: "shots/late-real-after-escape.png" });
// can the page be scrolled / used?
await page.mouse.wheel(0, 400); await page.waitForTimeout(300);
console.log("page scrollY after wheel:", await page.evaluate(() => scrollY), "| click another card ->");
await page.click('[data-tile="late-4"]', { force: true }); await page.waitForTimeout(1500);
console.log("   ", JSON.stringify(await page.evaluate(() => clean())));
await browser.close();
