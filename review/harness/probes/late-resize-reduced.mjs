import { launch, openScenario } from "./lib.mjs";
const browser = await launch();
// A) hero image with no reserved size, arriving 900ms after opening (first open only)
{
  const page = await openScenario(browser, { scenario: "late" });
  const rec = page.evaluate(() => record("late-2", 2500));
  await page.click('[data-tile="late-2"]');
  const frames = await rec;
  const withClone = frames.filter((f) => f.clone);
  console.log("LATE first open: first clone", JSON.stringify(withClone[0]?.clone), "| clone frames:", withClone.length);
  console.log("  hero box at start:", JSON.stringify(frames[1]?.hero), " hero box at end:", JSON.stringify(frames.at(-1).hero), "phase:", frames.at(-1).phase);
  const heroChanges = frames.filter((f, i) => i && JSON.stringify(f.hero) !== JSON.stringify(frames[i - 1].hero)).map((f) => ({ t: f.t, hero: f.hero }));
  console.log("  hero box changes:", JSON.stringify(heroChanges.slice(0, 4)));
  await page.screenshot({ path: "shots/late-mid.png" });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1200);
  const rec2 = page.evaluate(() => record("late-2", 1500));
  await page.click('[data-tile="late-2"]');
  const f2 = (await rec2).filter((f) => f.clone);
  console.log("LATE second open (cached): first clone", JSON.stringify(f2[0]?.clone && { ...f2[0].clone, clipPath: undefined }));
  console.log("  errors:", page.errors);
  await page.context().close();
}
// A2) screenshot sequence of first open of another late card
{
  const page = await openScenario(browser, { scenario: "late" });
  await page.click('[data-tile="late-3"]');
  for (const t of [100, 400, 1000]) { await page.waitForTimeout(t === 100 ? 100 : t === 400 ? 300 : 600); await page.screenshot({ path: `shots/late-${t}.png` }); }
  await page.context().close();
}
// B) resize the window while the card is opening
{
  const page = await openScenario(browser, { scenario: "grid" });
  await page.click('[data-tile="grid-1"]');
  await page.waitForTimeout(120);
  await page.setViewportSize({ width: 600, height: 800 });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => ({ phase: phase(), vw: innerWidth, card: R(card("grid-1").getBoundingClientRect()) }));
  console.log("RESIZE during opening -> after settle:", JSON.stringify(r));
  await page.screenshot({ path: "shots/resize-during-open.png" });
  // resize once more while open: does it recover?
  await page.setViewportSize({ width: 610, height: 800 });
  await page.waitForTimeout(300);
  console.log("  after a further resize while open:", JSON.stringify(await page.evaluate(() => R(card("grid-1").getBoundingClientRect()))));
  await page.context().close();
}
// B2) resize while open, then close: does it land on the moved source?
{
  const page = await openScenario(browser, { scenario: "grid" });
  await page.click('[data-tile="grid-5"]');
  await page.waitForTimeout(1300);
  await page.setViewportSize({ width: 700, height: 800 });
  await page.waitForTimeout(400);
  const rec = page.evaluate(() => record("grid-5", 1500));
  await page.keyboard.press("Escape");
  const fr = (await rec).filter((f) => f.clone);
  const s = await page.evaluate(() => src("grid-5"));
  console.log("RESIZE while open then close: last clone", JSON.stringify(fr.at(-1)?.clone && { x: fr.at(-1).clone.x, y: fr.at(-1).clone.y, w: fr.at(-1).clone.w, h: fr.at(-1).clone.h }), "source", JSON.stringify(s));
  await page.context().close();
}
// C) reduced motion
{
  const page = await openScenario(browser, { scenario: "grid" }, { reducedMotion: "reduce" });
  const rec = page.evaluate(() => record("grid-2", 1200));
  await page.click('[data-tile="grid-2"]');
  const frames = await rec;
  const transforms = await page.evaluate(() => getComputedStyle(document.querySelector(".zoom-zoomer")).transform);
  const cardRects = new Set(frames.filter((f) => f.card).map((f) => JSON.stringify(f.card)));
  console.log("REDUCED: clone frames:", frames.filter((f) => f.clone).length, "| distinct card positions:", cardRects.size, "| zoomer opacities:", [...new Set(frames.map((f) => f.zoomerOpacity))].length, "| zoomer transform:", transforms);
  // arrow paging in reduced motion
  await page.waitForTimeout(300);
  await page.keyboard.press("ArrowRight");
  const trackT = [];
  for (let i = 0; i < 5; i++) { trackT.push(await page.evaluate(() => getComputedStyle(document.querySelector(".zoom-track")).transform)); await page.waitForTimeout(40); }
  console.log("  track during arrow paging:", [...new Set(trackT)].length, "distinct values (1 = instant jump)");
  await page.context().close();
}
// C2) reduced-motion setting changed AFTER the page loaded (user flips the OS switch with the tab open)
{
  const page = await openScenario(browser, { scenario: "grid" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(100);
  const rec = page.evaluate(() => record("grid-2", 1200));
  await page.click('[data-tile="grid-2"]');
  const frames = await rec;
  console.log("REDUCED switched on after load: clone frames", frames.filter((f) => f.clone).length, "(0 would mean it respected the change), matchMedia now:", await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches));
  await page.context().close();
}
await browser.close();
