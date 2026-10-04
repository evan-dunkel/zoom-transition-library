// Checks for issues the existing test suite doesn't cover. Each block prints what a
// user would get. Run: node review/independent-review/probes/findings.mjs [name...]
import { launch, openPage, phase, waitPhase, rect, flyingBox, clean, activeCardId, focused, log } from "./lib.mjs";

const only = process.argv.slice(2);
const want = (n) => !only.length || only.includes(n);
const browser = await launch();
const shots = new URL("../evidence/", import.meta.url).pathname;
await import("node:fs").then((fs) => fs.mkdirSync(shots, { recursive: true }));

if (want("focus")) {
  log("\n== focus after opening, by close-button setting ==");
  for (const [label, props] of [
    ["default close button", {}],
    ["closeButton={false}", { closeButton: false }],
  ]) {
    const page = await openPage(browser, { scenario: "grid", props });
    await page.focus('[data-tile="grid-2"]');
    await page.keyboard.press("Enter");
    await page.waitForTimeout(60);
    const during = await focused(page);
    await waitPhase(page, "open");
    await page.waitForTimeout(100);
    const after = await focused(page);
    await page.keyboard.press("Tab");
    const tab1 = await focused(page);
    log(`  ${label}: while opening → ${during}; once open → ${after}; after one Tab → ${tab1}`);
    await page.context().close();
  }
  // A custom close button rendered with a function, wired with onClick (no data-zoom-close).
  // Can't pass a function through JSON, so patch it in through the page: re-render isn't possible,
  // so this one is checked by reading the code path instead (openDone focuses [data-zoom-close] only).
}

if (want("hscroll")) {
  log("\n== sideways-scrolling content inside a card ==");
  const page = await openPage(browser, { scenario: "hscroll" });
  await page.click('[data-tile="hscroll-2"]');
  await waitPhase(page, "open");
  await page.waitForTimeout(200);
  const strip = await rect(page, '.zoom-card:not([inert]) [data-strip]');
  await page.evaluate(() => document.querySelector(".zoom-card:not([inert]) .zoom-card-scroll").scrollTo(0, 0));
  await page.mouse.move(strip.x + strip.w / 2, strip.y + strip.h / 2);
  for (let i = 0; i < 12; i++) {
    await page.mouse.wheel(30, 0); // trackpad sideways swipe / shift+wheel
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(700);
  const res = await page.evaluate(() => ({ stripScrolled: document.querySelector('[data-zoom-id="hscroll-2"] [data-strip]').scrollLeft }));
  log(`  trackpad swipe sideways over the photo strip: strip scrolled ${res.stripScrolled}px; visible card is now ${await activeCardId(page)} (was hscroll-2)`);
  await page.context().close();

  // Touch: sideways finger drag over the strip.
  const tp = await openPage(browser, { scenario: "hscroll" }, { viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
  await tp.click('[data-tile="hscroll-2"]');
  await waitPhase(tp, "open");
  await tp.waitForTimeout(200);
  await tp.evaluate(() => document.querySelector('.zoom-card:not([inert]) [data-strip]').scrollIntoView({ block: "center" }));
  await tp.waitForTimeout(100);
  const s2 = await rect(tp, '.zoom-card:not([inert]) [data-strip]');
  const cdp = await tp.context().newCDPSession(tp);
  const y = s2.y + s2.h / 2;
  const touch = (type, x) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
  await touch("touchStart", 300);
  for (let x = 290; x >= 120; x -= 10) await touch("touchMove", x);
  await touch("touchEnd", 120);
  await tp.waitForTimeout(800);
  const r2 = await tp.evaluate(() => document.querySelector('[data-zoom-id="hscroll-2"] [data-strip]').scrollLeft);
  log(`  finger drag sideways over the photo strip (phone): strip scrolled ${r2}px; visible card is now ${await activeCardId(tp)} (was hscroll-2)`);
  await tp.context().close();
}

if (want("slow")) {
  log("\n== big detail photo still downloading (space reserved with width/height) ==");
  const page = await openPage(browser, { scenario: "slow", slowMs: 2500, timeScale: 0.25 });
  const src = await rect(page, '[data-tile="slow-2"] .thumb');
  await page.screenshot({ path: shots + "slow-before.png", clip: { x: src.x - 40, y: src.y - 40, width: src.w + 80, height: src.h + 80 } });
  await page.click('[data-tile="slow-2"]');
  await page.waitForTimeout(90);
  const fb = await flyingBox(page);
  // What is under the flying copy's centre: the picture, or blank card?
  const info = await page.evaluate(() => {
    const clone = document.querySelector(".zoom-clone");
    const img = clone?.querySelector("img");
    return { cloneHasImage: !!img, imgSrc: img ? (img.getAttribute("src") ? "set" : "none") : "-", complete: img?.complete, naturalWidth: img?.naturalWidth };
  });
  await page.screenshot({ path: shots + "slow-takeoff.png" });
  log(`  at take-off (90 ms, slowed 4×): flying copy at ${JSON.stringify(fb)}, thumbnail was ${JSON.stringify(src)}; copy contains img: ${info.cloneHasImage}, its src: ${info.imgSrc}, naturalWidth ${info.naturalWidth}`);
  const px = await page.evaluate(async (fb) => {
    // Sample the rendered colour at the copy's centre from a screenshot-like read isn't possible
    // in-page; report the thumbnail's visibility instead.
    const thumb = document.querySelector('[data-tile="slow-2"] .thumb');
    return getComputedStyle(thumb).visibility;
  }, fb);
  log(`  the page's own thumbnail is now: ${px} (screenshots: evidence/slow-before.png, evidence/slow-takeoff.png)`);
  await page.context().close();
}

if (want("dupe")) {
  log("\n== the same item shown twice on the page (featured + grid) ==");
  const page = await openPage(browser, { scenario: "dupe", timeScale: 0.25 });
  const featured = await rect(page, '.featured [data-tile="dupe-5"] .thumb');
  const inGrid = await rect(page, 'main > .tiles [data-tile="dupe-5"] .thumb');
  await page.click('.featured [data-tile="dupe-5"]');
  await page.waitForTimeout(40);
  const first = await flyingBox(page);
  log(`  clicked the FEATURED tile at ${JSON.stringify(featured)}; the zoom started from ${JSON.stringify(first)}; the grid copy is at ${JSON.stringify(inGrid)}`);
  const hidden = await page.evaluate(() => [...document.querySelectorAll('[data-tile="dupe-5"] .thumb')].map((t) => t.hasAttribute("data-zoom-hidden")));
  log(`  which copies got hidden (featured, grid): ${JSON.stringify(hidden)}`);
  await page.context().close();
}

if (want("throw")) {
  log("\n== one item's detail content throws while rendering ==");
  const page = await openPage(browser, { scenario: "throw" });
  await page.click('[data-tile="throw-1"]'); // a different, healthy item in the same group
  await page.waitForTimeout(1200);
  const state = await page.evaluate(() => ({ tiles: document.querySelectorAll("[data-tile]").length, bodyText: document.body.innerText.slice(0, 80), overflow: document.documentElement.style.overflow, inert: document.querySelectorAll("[inert]").length }));
  log(`  opened a healthy item (throw-1); item 5 throws. Page afterwards: ${JSON.stringify(state)}; errors: ${page.errors.slice(0, 1).join(" | ")}`);
  await page.context().close();
}

if (want("strict")) {
  log("\n== React StrictMode (common in development) ==");
  const page = await openPage(browser, { scenario: "grid", strict: true });
  await page.click('[data-tile="grid-2"]');
  const opened = await waitPhase(page, "open");
  await page.keyboard.press("Escape");
  await waitPhase(page, "idle");
  await page.waitForTimeout(200);
  log(`  opened: ${opened}; after Esc: ${JSON.stringify(await clean(page))}; errors: ${page.errors.length}`);
  await page.context().close();
}

if (want("deeplink")) {
  log("\n== reload / shared link while a card is open (history on) ==");
  const page = await openPage(browser, { scenario: "rapid" });
  await page.click('[data-tile="rapid-3"]');
  await waitPhase(page, "open");
  const url = page.url();
  await page.reload();
  await page.waitForSelector("[data-tile]");
  await page.waitForTimeout(800);
  log(`  address while open: …${url.slice(url.lastIndexOf("#"))}; after reload the phase is "${await phase(page)}" (a card is ${(await phase(page)) === "open" ? "" : "NOT "}open)`);
  await page.context().close();
}

if (want("backfwd")) {
  log("\n== Back closes, Forward reopens (history on) ==");
  const page = await openPage(browser, { scenario: "rapid" });
  await page.click('[data-tile="rapid-3"]');
  await waitPhase(page, "open");
  await page.goBack();
  await waitPhase(page, "idle");
  const afterBack = await phase(page);
  await page.goForward();
  await page.waitForTimeout(1200);
  log(`  after Back: ${afterBack}; after Forward: ${await phase(page)} (card ${await activeCardId(page)})`);
  await page.keyboard.press("Escape");
  await waitPhase(page, "idle");
  await page.waitForTimeout(300);
  log(`  after Esc: ${JSON.stringify(await clean(page))}; address …${page.url().slice(page.url().lastIndexOf("/"))}`);
  await page.context().close();
}

await browser.close();
