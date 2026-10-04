import { launch, PAGE_HELPERS } from "./lib.mjs";
import { pathToFileURL } from "node:url";
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto("data:text/html,<p>previous site</p>");
const errs = []; page.on("pageerror", (e) => errs.push(e.message)); page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
await page.goto(pathToFileURL(process.cwd() + "/../demo/zoom-demo.html").href);
await page.screenshot({ path: "shots/demo-top.png" });
const ids = ["grid", "scrolled", "mobile", "reduced", "rapid", "late", "carousel", "keyboard"];
for (const id of ids) {
  await page.locator(`#s-${id}`).scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  const frame = page.frameLocator(`iframe[data-scenario="${id}"]`);
  const f = page.frames().find((fr) => fr.url().startsWith("about:srcdoc") && fr !== page.mainFrame() && 0) ;
  const handle = await page.$(`iframe[data-scenario="${id}"]`);
  const fr = await handle.contentFrame();
  await fr.waitForSelector(".tile", { timeout: 10000 });
  await fr.addScriptTag({ content: PAGE_HELPERS });
  const tile = id === "late" ? "late-1" : `${id}-2`;
  await fr.click(`[data-tile="${tile}"]`);
  await page.waitForTimeout(1500);
  const st = await fr.evaluate(() => ({ phase: phase(), clones: document.querySelectorAll(".zoom-clone").length, status: document.querySelector(".status")?.textContent }));
  await page.locator(`#s-${id}`).screenshot({ path: `shots/demo-${id}.png` });
  await fr.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
  await page.waitForTimeout(1200);
  const st2 = await fr.evaluate(() => clean());
  console.log(id.padEnd(9), "open:", st.phase, "| after Esc:", st2.phase, st2.clones, "|", st.status);
}
// late card 2 (reserved) should work after reload
await page.click('[data-reload="late"]'); await page.waitForTimeout(800);
const lf = await (await page.$('iframe[data-scenario="late"]')).contentFrame();
await lf.waitForSelector(".tile"); await lf.addScriptTag({ content: PAGE_HELPERS });
await lf.click('[data-tile="late-2"]'); await page.waitForTimeout(2200);
console.log("late-2 (reserved):", await lf.evaluate(() => phase()));
// speed toggle reaches the frames
await page.click('[data-speed="0.25"]'); await page.waitForTimeout(200);
const gf = await (await page.$('iframe[data-scenario="grid"]')).contentFrame();
await gf.addScriptTag({ content: PAGE_HELPERS });
await gf.click('[data-tile="grid-3"]'); await page.waitForTimeout(700);
console.log("slow motion: phase 700ms after click:", await gf.evaluate(() => phase()), "(expect opening)");
console.log("errors:", errs, "| main URL still demo:", page.url().endsWith("zoom-demo.html"));
await browser.close();
