import { launch, openScenario } from "./lib.mjs";
const browser = await launch();
const listenerCount = async (page) => {
  const cdp = await page.context().newCDPSession(page);
  const count = async (expr) => { const { result } = await cdp.send("Runtime.evaluate", { expression: expr }); const { listeners } = await cdp.send("DOMDebugger.getEventListeners", { objectId: result.objectId }); return listeners.length; };
  return { window: await count("window"), document: await count("document") };
};
const runTest = async (page, name) => {
  await page.evaluate((name) => [...document.querySelectorAll(".tester-buttons button")].find((b) => b.textContent === name).click(), name);
  await page.waitForFunction(() => /finished/.test(document.querySelector(".tester-log").textContent), null, { timeout: 30000 });
  return page.evaluate(() => ({ log: document.querySelector(".tester-log").textContent, clean: clean(), hash: location.hash, histLen: history.length }));
};
{
  const page = await openScenario(browser, { scenario: "rapid" });
  const l0 = await listenerCount(page);
  for (const t of ["Double-click a card", "Click 8 times fast (two cards)", "Open, then Esc halfway", "Open, then browser Back halfway", "Close, then tap the card as it flies home", "Open, then arrow keys quickly", "Chaos: 25 random actions"]) {
    const r = await runTest(page, t);
    console.log(t.padEnd(44), "|", r.log.replace(/^.*finished\. /, ""), "|", JSON.stringify({ ...r.clean, hash: r.hash }));
    if (r.clean.phase === "open") { await page.keyboard.press("Escape"); await page.waitForTimeout(1200); }
  }
  for (let i = 0; i < 20; i++) { await page.click('[data-tile="rapid-1"]'); await page.waitForTimeout(700); await page.keyboard.press("Escape"); await page.waitForTimeout(700); }
  const l1 = await listenerCount(page);
  console.log("listeners before:", JSON.stringify(l0), "after ~45 transitions:", JSON.stringify(l1), "| clean:", JSON.stringify(await page.evaluate(() => clean())), "errors:", page.errors);
  await page.context().close();
}
// history: open (URL gets #id), reload, deep link
{
  const page = await openScenario(browser, { scenario: "rapid" });
  await page.click('[data-tile="rapid-3"]'); await page.waitForTimeout(1200);
  const url = page.url();
  console.log("\nHISTORY open -> URL hash:", new URL(url).hash, "history.length", await page.evaluate(() => history.length));
  await page.reload(); await page.waitForTimeout(800);
  console.log("reload with that URL -> phase:", await page.evaluate(() => document.querySelector(".zoom-root")?.dataset.phase ?? "idle"), "| hash still:", new URL(page.url()).hash);
  await page.goBack(); await page.waitForTimeout(800);
  await page.goForward(); await page.waitForTimeout(1500);
  console.log("then Back, Forward -> phase:", await page.evaluate(() => document.querySelector(".zoom-root")?.dataset.phase ?? "idle"));
  await page.context().close();
  const p2 = await (await browser.newContext()).newPage();
  await p2.goto(url); await p2.waitForTimeout(1000);
  console.log("fresh tab opening the shared link", new URL(url).hash, "-> phase:", await p2.evaluate(() => document.querySelector(".zoom-root")?.dataset.phase ?? "idle"));
  await p2.context().close();
}
// back during open, forward again; back in "item" mode after paging
{
  const page = await openScenario(browser, { scenario: "grid", props: { history: { mode: "item" } } });
  await page.click('[data-tile="grid-1"]'); await page.waitForTimeout(1200);
  await page.keyboard.press("ArrowRight"); await page.waitForTimeout(700);
  await page.keyboard.press("ArrowRight"); await page.waitForTimeout(700);
  const seq = [];
  for (let i = 0; i < 3; i++) { await page.goBack(); await page.waitForTimeout(900); seq.push(await page.evaluate(() => `${phase()}:${document.querySelector('.zoom-card:not([inert])')?.dataset.zoomId ?? "-"}:${location.hash}`)); }
  console.log("ITEM mode, Back x3:", seq.join("  ->  "));
  await page.context().close();
}
// source hidden by a responsive layout while open (display:none), then close
{
  const page = await openScenario(browser, { scenario: "grid" });
  await page.click('[data-tile="grid-2"]'); await page.waitForTimeout(1200);
  await page.evaluate(() => document.querySelector('[data-tile="grid-2"]').closest("li").style.display = "none");
  const rec = page.evaluate(() => record("grid-2", 1500));
  await page.keyboard.press("Escape");
  const fr = await rec;
  const bad = fr.filter((f) => f.clone && /NaN|Infinity/.test(JSON.stringify(f.clone) + f.clone.raw));
  console.log("\nSOURCE display:none then close: frames with NaN/Infinity clone:", bad.length, "| end:", JSON.stringify(await page.evaluate(() => clean())), "| last clone:", JSON.stringify(fr.filter((f) => f.clone).at(-1)?.clone));
  await page.context().close();
}
await browser.close();
