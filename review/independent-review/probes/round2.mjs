// Follow-ups from the designer's demo results. Run: node review/independent-review/probes/round2.mjs [name...]
import { launch, openPage, waitPhase, phase, log } from "./lib.mjs";
const only = process.argv.slice(2);
const want = (n) => !only.length || only.includes(n);
const browser = await launch();

/** Every card's on-screen box and opacity, every frame, for `ms`. */
const recordCards = (page, ms) =>
  page.evaluate((ms) => new Promise((resolve) => {
    const out = [];
    const t0 = performance.now();
    const step = (now) => {
      const z = document.querySelector(".zoom-zoomer");
      const cards = [...document.querySelectorAll(".zoom-card")].map((c) => {
        const r = c.getBoundingClientRect();
        return { id: c.dataset.zoomId, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), o: +getComputedStyle(c).opacity, clip: !!c.style.clipPath };
      });
      out.push({ t: Math.round(now - t0), phase: document.querySelector(".zoom-root")?.dataset.phase, zo: z ? +getComputedStyle(z).opacity : null, cards });
      if (now - t0 < ms) requestAnimationFrame(step); else resolve(out);
    };
    requestAnimationFrame(step);
  }), ms);

if (want("phone-first")) {
  log("\n== phone width: what the neighbouring cards do on the first open vs. the second ==");
  const page = await openPage(browser, { scenario: "phone", timeScale: 0.25 }, { viewport: { width: 390, height: 760 } });
  for (const run of [1, 2]) {
    const rec = recordCards(page, 2200);
    await page.click('[data-tile="phone-2"] .tile-title');
    const frames = await rec;
    const firstWithCards = frames.find((f) => f.cards.length > 1);
    const n = firstWithCards?.cards.find((c) => c.id === "phone-3");
    const i = frames.indexOf(firstWithCards);
    const seq = frames.slice(i, i + 6).map((f) => { const c = f.cards.find((c) => c.id === "phone-3"); return `t${f.t}: x${c?.x} y${c?.y} w${c?.w} zoomerOpacity ${f.zo?.toFixed(2)}`; });
    log(`  open #${run}: neighbour card phone-3, first frames:\n    ${seq.join("\n    ")}`);
    await waitPhase(page, "open");
    await page.keyboard.press("Escape");
    await waitPhase(page, "idle");
    await page.waitForTimeout(400);
  }
  await page.context().close();
}

if (want("interrupt")) {
  log("\n== repeated interruption (click, Esc, click, Esc…) in very slow motion: frame-to-frame jumps ==");
  const page = await openPage(browser, { scenario: "rapid", timeScale: 0.1 });
  const rec = recordCards(page, 14000);
  await page.click('[data-tile="rapid-2"]');
  await page.waitForTimeout(2500);
  for (let k = 0; k < 3; k++) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(1200);
    // Click where the active card is right now (as a person would, on the card as it flies home).
    const at = await page.evaluate(() => { const r = document.querySelector('.zoom-card[data-zoom-id="rapid-2"]')?.getBoundingClientRect(); return r && { x: r.left + r.width / 2, y: r.top + Math.min(40, r.height / 2) }; });
    if (at) await page.mouse.click(at.x, at.y);
    await page.waitForTimeout(1200);
  }
  await page.keyboard.press("Escape");
  const frames = await rec;
  // A jerk: a card on screen whose per-frame movement changes by more than 12 px from one
  // frame to the next (at ×0.1 speed, smooth motion changes by well under 1 px per frame),
  // or whose opacity changes by more than 0.25 in one frame.
  const jumps = [];
  const vis = (c) => c.x + c.w > 0 && c.x < 1200;
  const get = (f, id) => f?.cards.find((d) => d.id === id);
  for (let i = 2; i < frames.length; i++) {
    for (const c of frames[i].cards) {
      const p = get(frames[i - 1], c.id), q = get(frames[i - 2], c.id);
      if (!p || !q || !vis(c)) continue;
      const jx = (c.x - p.x) - (p.x - q.x), jy = (c.y - p.y) - (p.y - q.y), jw = (c.w - p.w) - (p.w - q.w);
      if (Math.max(Math.abs(jx), Math.abs(jy), Math.abs(jw)) > 12) jumps.push(`t${frames[i].t} ${frames[i].phase} ${c.id}: x ${q.x}→${p.x}→${c.x}, y ${q.y}→${p.y}→${c.y}, w ${q.w}→${p.w}→${c.w}`);
      if (Math.abs(c.o - p.o) > 0.25) jumps.push(`t${frames[i].t} ${frames[i].phase} ${c.id}: opacity ${p.o.toFixed(2)}→${c.o.toFixed(2)}`);
    }
  }
  const events = [];
  for (let i = 1; i < frames.length; i++) if (frames[i].phase !== frames[i - 1].phase) events.push(`t${frames[i].t} ${frames[i - 1].phase}→${frames[i].phase}`);
  log("  phases: " + events.join(", "));
  log(`  ${jumps.length} jumps in ${frames.length} frames${jumps.length ? ":\n    " + jumps.slice(0, 25).join("\n    ") : ""}`);
  await page.context().close();
}

if (want("focus-steal")) {
  log("\n== focus moved by the library after the visitor has moved on ==");
  const page = await openPage(browser, { scenario: "grid" });
  await page.evaluate(() => {
    const i = document.createElement("input");
    i.id = "search";
    i.placeholder = "Search";
    document.querySelector("main").prepend(i);
  });
  await page.click('[data-tile="grid-5"]');
  await waitPhase(page, "open");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(60); // the card is flying home; the page is live again
  await page.click("#search");
  await page.keyboard.type("ab");
  const typingIn = await page.evaluate(() => document.activeElement.id);
  await waitPhase(page, "idle");
  await page.keyboard.type("cd");
  const after = await page.evaluate(() => ({ active: document.activeElement.id || document.activeElement.dataset.tile || document.activeElement.tagName, value: document.querySelector("#search").value }));
  log(`  clicked a search box while the card flew home and typed "ab" (focus: ${typingIn}); after landing typed "cd": focus is on ${after.active}, the box contains "${after.value}"`);
  await page.context().close();
}

if (want("page-settle")) {
  log("\n== how long a page turn (← →) takes to come to rest ==");
  for (const page_ of [null, { duration: 0.35, bounce: 0 }, { duration: 0.3, bounce: 0.1 }]) {
  const page = await openPage(browser, { scenario: "grid", props: page_ ? { timing: { page: page_ } } : {} });
  log(`  timing.page = ${page_ ? JSON.stringify(page_) : "default {duration:0.5,bounce:0}"}`);
  await page.click('[data-tile="grid-2"]');
  await waitPhase(page, "open");
  await page.waitForTimeout(300);
  const res = await page.evaluate(() => new Promise((resolve) => {
    const track = document.querySelector(".zoom-track");
    const xs = [];
    const t0 = performance.now();
    const step = (now) => {
      xs.push({ t: now - t0, x: new DOMMatrix(getComputedStyle(track).transform).m41 });
      if (now - t0 < 2000) requestAnimationFrame(step); else resolve(xs);
    };
    requestAnimationFrame(step);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
  }));
  const start = res[0].x;
  const end = res.at(-1).x;
  const dist = Math.abs(end - start);
  const when = (frac) => res.find((p) => Math.abs(p.x - start) >= dist * frac)?.t ?? NaN;
  const lastMove = [...res].reverse().find((p, i, a) => i + 1 < a.length && Math.abs(p.x - a[i + 1].x) > 0.01)?.t ?? NaN;
  log(`  distance ${dist.toFixed(0)} px; 90% there at ${when(0.9).toFixed(0)} ms, 99% at ${when(0.99).toFixed(0)} ms, still creeping until ${lastMove.toFixed(0)} ms`);
  await page.context().close();
  }
}
await browser.close();
