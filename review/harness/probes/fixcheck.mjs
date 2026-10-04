import { launch, openScenario } from "./lib.mjs";
const browser = await launch();
{
  const page = await openScenario(browser, { scenario: "keyboard" });
  await page.click('[data-tile="keyboard-2"]'); await page.waitForTimeout(1200);
  console.log("inert body children:", await page.evaluate(() => [...document.body.children].map((e) => `${e.tagName}#${e.id}.${e.className}:${e.inert}`).join(" | ")));
  for (let i = 0; i < 5; i++) { await page.keyboard.press("Tab"); console.log("tab", i, await page.evaluate(() => { const a = document.activeElement; return `${a?.tagName} ${a?.className} inOverlay=${!!a?.closest(".zoom-root")}`; })); }
  await page.context().close();
}
{
  const page = await openScenario(browser, { scenario: "grid" }, { reducedMotion: "reduce" });
  const rec = page.evaluate(() => record("grid-2", 800));
  await page.click('[data-tile="grid-2"]');
  const fr = await rec;
  console.log("reduced: phases", [...new Set(fr.map((f) => f.phase))], "cards seen", fr.filter((f) => f.card).length, "distinct", new Set(fr.filter((f) => f.card).map((f) => JSON.stringify(f.card))).size, "zoomer opacities", [...new Set(fr.map((f) => f.zoomerOpacity))], "first card", JSON.stringify(fr.find((f) => f.card)?.card), "last", JSON.stringify(fr.at(-1).card));
  await page.context().close();
}
{
  const page = await openScenario(browser, { scenario: "grid" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(200);
  console.log("live: matches", await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches));
  const rec = page.evaluate(() => record("grid-2", 800));
  await page.click('[data-tile="grid-2"]');
  const fr = await rec;
  console.log("live reduced: clone frames", fr.filter((f) => f.clone).length, "phases", [...new Set(fr.map((f) => f.phase))]);
  await page.context().close();
}
await browser.close();
