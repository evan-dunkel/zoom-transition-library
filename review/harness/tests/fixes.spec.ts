/**
 * Browser checks for the fixes made after the independent review
 * (review/independent-review/review-report.md). Each test states the behaviour a user should get.
 *
 * Run: npm test (from the repository root)
 */
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import { PAGE_HELPERS } from "../probes/lib.mjs";

const dist = join(fileURLToPath(new URL(".", import.meta.url)), "..", "dist");
const url = (cfg: object) => pathToFileURL(join(dist, "test.html")).href + "?" + encodeURIComponent(JSON.stringify(cfg));

async function open(page: Page, cfg: object) {
  await page.goto(url(cfg));
  await page.addScriptTag({ content: PAGE_HELPERS });
}
const phase = (page: Page) => page.evaluate(() => (window as any).phase());
const clean = (page: Page) => page.evaluate(() => (window as any).clean());
const activeId = (page: Page) => page.evaluate(() => document.querySelector<HTMLElement>(".zoom-card:not([inert])")?.dataset.zoomId);

test("a detail photo still downloading: the thumbnail's picture flies instead of an empty box", async ({ page, context }) => {
  await context.route("http://demo.test/**", async (route) => {
    const p = new URL(route.request().url()).pathname;
    if (p === "/") return route.fulfill({ contentType: "text/html", body: readFileSync(join(dist, "test.html"), "utf8") });
    if (p === "/app.js") return route.fulfill({ contentType: "text/javascript", body: readFileSync(join(dist, "app.js"), "utf8") });
    await new Promise((r) => setTimeout(r, 1500));
    return route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="1600" height="1000" fill="#7aa"/></svg>' });
  });
  await page.goto("http://demo.test/?" + encodeURIComponent(JSON.stringify({ scenario: "late", lateUrl: "http://demo.test/img" })));
  await page.addScriptTag({ content: PAGE_HELPERS });
  await page.click('[data-tile="late-2"]'); // its page reserves the photo's space
  await page.waitForTimeout(120);
  const img = await page.evaluate(() => {
    const i = document.querySelector<HTMLImageElement>('.zoom-clone[data-zoom-id="late-2"] img');
    return i && { src: i.getAttribute("src")!.slice(0, 20), shown: i.complete && i.naturalWidth > 0 };
  });
  expect(img).toEqual({ src: "data:image/svg+xml;c", shown: true }); // the thumbnail's own picture
  await expect.poll(() => phase(page), { timeout: 4000 }).toBe("open");
  await page.keyboard.press("Escape");
  await expect.poll(() => clean(page), { timeout: 4000 }).toMatchObject({ phase: "idle", clones: 0, hidden: 0, inert: 0 });
});

test("at take-off the other thumbnails fade with the opening instead of blinking out", async ({ page }) => {
  await open(page, { scenario: "grid", timeScale: 0.25 });
  await page.click('[data-tile="grid-2"]');
  await page.waitForTimeout(40);
  const early = await page.evaluate(() => ({
    hidden: document.querySelectorAll("[data-zoom-hidden]").length,
    other: +getComputedStyle(document.querySelector('[data-zoom-react-source="grid-6"]')!).opacity,
  }));
  expect(early.hidden).toBe(1); // only the clicked one, which its flying picture covers
  expect(early.other).toBeGreaterThan(0.8);
  await expect.poll(() => phase(page), { timeout: 12000 }).toBe("open");
  expect(+(await page.evaluate(() => getComputedStyle(document.querySelector('[data-zoom-react-source="grid-6"]')!).opacity))).toBe(0);
  await page.keyboard.press("Escape");
  await expect.poll(() => clean(page), { timeout: 12000 }).toMatchObject({ phase: "idle", hidden: 0, dimmed: 0 });
});

test.describe("content that scrolls sideways inside a card", () => {
  test("scrolls with a sideways wheel or trackpad swipe, instead of turning the page", async ({ page }) => {
    await open(page, { scenario: "hscroll" });
    await page.click('[data-tile="hscroll-2"]');
    await expect.poll(() => phase(page)).toBe("open");
    const r = await page.evaluate(() => {
      const s = document.querySelector('.zoom-card:not([inert]) [data-strip]')!;
      s.scrollIntoView({ block: "center" });
      const b = s.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    });
    await page.mouse.move(r.x, r.y);
    for (let i = 0; i < 10; i++) await page.mouse.wheel(30, 0);
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => document.querySelector('[data-zoom-id="hscroll-2"] [data-strip]')!.scrollLeft)).toBeGreaterThan(100);
    expect(await activeId(page)).toBe("hscroll-2");
    // Elsewhere on the card, a sideways swipe still turns the page.
    await page.mouse.move(r.x, 200);
    for (let i = 0; i < 4; i++) await page.mouse.wheel(30, 0);
    await expect.poll(() => activeId(page)).toBe("hscroll-3");
  });

  test.describe("touch", () => {
    test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 800 } });
    test("scrolls with a sideways finger drag, instead of turning the page", async ({ page }) => {
      await open(page, { scenario: "hscroll" });
      await page.click('[data-tile="hscroll-2"]');
      await expect.poll(() => phase(page)).toBe("open");
      const y = await page.evaluate(() => {
        const s = document.querySelector('.zoom-card:not([inert]) [data-strip]')!;
        s.scrollIntoView({ block: "center" });
        const b = s.getBoundingClientRect();
        return b.top + b.height / 2;
      });
      await page.waitForTimeout(100);
      const cdp = await page.context().newCDPSession(page);
      const touch = (type: string, x: number) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
      await touch("touchStart", 300);
      for (let x = 290; x >= 120; x -= 10) await touch("touchMove", x);
      await touch("touchEnd", 120);
      await page.waitForTimeout(700);
      expect(await page.evaluate(() => document.querySelector('[data-zoom-id="hscroll-2"] [data-strip]')!.scrollLeft)).toBeGreaterThan(80);
      expect(await activeId(page)).toBe("hscroll-2");
    });
  });
});

test.describe("focus", () => {
  test("without a close button, focus still moves into the card (from the start of the opening)", async ({ page }) => {
    await open(page, { scenario: "grid", props: { closeButton: false } });
    await page.focus('[data-tile="grid-2"]');
    await page.keyboard.press("Enter");
    await page.waitForTimeout(50);
    expect(await page.evaluate(() => !!document.activeElement?.closest(".zoom-root"))).toBe(true);
    await expect.poll(() => phase(page)).toBe("open");
    expect(await page.evaluate(() => (document.activeElement as HTMLElement).dataset.zoomId)).toBe("grid-2");
    await page.keyboard.press("Escape");
    await expect.poll(() => phase(page)).toBe("idle");
    expect(await page.evaluate(() => (document.activeElement as HTMLElement).dataset.tile)).toBe("grid-2");
  });

  test("a field clicked while the card flies home keeps focus when it lands", async ({ page }) => {
    await open(page, { scenario: "grid" });
    await page.evaluate(() => {
      const i = document.createElement("input");
      i.id = "search";
      document.querySelector("main")!.prepend(i);
    });
    await page.click('[data-tile="grid-5"]');
    await expect.poll(() => phase(page)).toBe("open");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(40);
    await page.click("#search");
    await page.keyboard.type("ab");
    await expect.poll(() => phase(page)).toBe("idle");
    await page.keyboard.type("cd");
    expect(await page.inputValue("#search")).toBe("abcd");
  });
});

test("an item shown twice zooms from the copy that was clicked, and lands back on it", async ({ page }) => {
  await open(page, { scenario: "dupe", timeScale: 0.25 });
  const featured = await page.evaluate(() => (window as any).R(document.querySelector('.featured [data-zoom-react-source="dupe-4"]')!.getBoundingClientRect()));
  const rec = page.evaluate(() => (window as any).record("dupe-4", 400));
  await page.click('.featured [data-tile="dupe-4"]');
  const first = ((await rec) as any[]).find((f) => f.clone && f.clone.w !== undefined).clone;
  expect(Math.abs(first.x - featured.x) + Math.abs(first.y - featured.y)).toBeLessThan(3);
  expect(await page.evaluate(() => [...document.querySelectorAll('[data-zoom-react-source="dupe-4"]')].map((e) => e.hasAttribute("data-zoom-hidden")))).toEqual([true, false]);
  await expect.poll(() => phase(page), { timeout: 12000 }).toBe("open");
  await page.keyboard.press("Escape");
  await expect.poll(() => clean(page), { timeout: 12000 }).toMatchObject({ phase: "idle", clones: 0, hidden: 0 });
});

test("one item that fails to render shows a message in its card; the page and the other items keep working", async ({ page }) => {
  await open(page, { scenario: "throw" });
  await page.click('[data-tile="throw-4"]'); // its neighbour, throw-5, is the broken one
  await expect.poll(() => phase(page)).toBe("open");
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => activeId(page)).toBe("throw-5");
  expect(await page.evaluate(() => document.querySelector('[data-zoom-id="throw-5"] .zoom-error')?.textContent)).toContain("couldn’t be shown");
  await page.keyboard.press("Escape");
  await expect.poll(() => clean(page)).toMatchObject({ phase: "idle", clones: 0, hidden: 0, inert: 0 });
  expect(await page.locator("[data-tile]").count()).toBe(9);
});

test.describe("deep links (history on, default #id addresses)", () => {
  test("a shared or reloaded #id link opens that card at once; closing takes the #id off the address", async ({ page }) => {
    await page.goto(url({ scenario: "rapid" }) + "#rapid-3");
    await page.addScriptTag({ content: PAGE_HELPERS });
    await expect.poll(() => phase(page), { timeout: 3000 }).toBe("open");
    expect(await activeId(page)).toBe("rapid-3");
    await page.keyboard.press("Escape");
    await expect.poll(() => clean(page)).toMatchObject({ phase: "idle", clones: 0, hidden: 0, inert: 0, htmlOverflow: "" });
    expect(new URL(page.url()).hash).toBe("");
    // And motion is back to normal afterwards: the next open flies.
    const rec = page.evaluate(() => (window as any).record("rapid-2", 500));
    await page.click('[data-tile="rapid-2"]');
    expect(((await rec) as any[]).some((f) => f.clone)).toBe(true);
  });
});

test("a page turn settles quickly (no long creep at the end)", async ({ page }) => {
  await open(page, { scenario: "grid" });
  await page.click('[data-tile="grid-2"]');
  await expect.poll(() => phase(page)).toBe("open");
  await page.waitForTimeout(200);
  const settled = await page.evaluate(() => new Promise<number>((resolve) => {
    const track = document.querySelector<HTMLElement>(".zoom-track")!;
    const x = () => new DOMMatrix(getComputedStyle(track).transform).m41;
    const t0 = performance.now();
    let last = x();
    let still = 0;
    const step = (now: number) => {
      const v = x();
      still = Math.abs(v - last) < 0.01 ? still + 1 : 0;
      last = v;
      if (still >= 5) resolve(now - t0);
      else requestAnimationFrame(step);
    };
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    requestAnimationFrame(step);
  }));
  expect(settled).toBeLessThan(650); // was ~850 ms of motion before (plus the 5 still frames counted here)
});

test("only the visible card shows its close button", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await open(page, { scenario: "grid" });
  await page.click('[data-tile="grid-2"]');
  await expect.poll(() => phase(page)).toBe("open");
  const o = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".zoom-card")].map((c) => [c.dataset.zoomId, getComputedStyle(c.querySelector(".zoom-close-bar")!).opacity]));
  expect(o.filter(([, v]) => v === "1").map(([id]) => id)).toEqual(["grid-2"]);
});

test("a big group starts its zoom with only the visible card and its neighbours, and fills in the rest after landing", async ({ page }) => {
  await open(page, { scenario: "big" });
  await page.click('[data-tile="big-6"]');
  expect(await page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".zoom-card")].map((c) => c.dataset.zoomId))).toEqual(["big-5", "big-6", "big-7"]);
  await expect.poll(() => phase(page)).toBe("open");
  await expect.poll(() => page.evaluate(() => document.querySelectorAll(".zoom-card").length), { timeout: 4000 }).toBe(12);
  await page.keyboard.press("Escape");
  await expect.poll(() => clean(page)).toMatchObject({ phase: "idle", clones: 0, hidden: 0, cards: 0 });
});

test("a thumbnail half under a sticky header: the flying picture is cut straight at the header, taking off and landing", async ({ page }) => {
  await open(page, { scenario: "scrolled", timeScale: 0.2 });
  await page.evaluate(() => {
    const t = document.querySelector('[data-zoom-react-source="scrolled-2"]')!.getBoundingClientRect();
    scrollBy(0, t.top - 10); // its top 50 px under the 60 px header, the rest below it
  });
  await page.waitForTimeout(150);
  const source = await page.evaluate(() => (window as any).src("scrolled-2"));
  // Each frame: the copy's own box (its rounded shape) and the straight cut it sits in.
  const trace = (ms: number) =>
    page.evaluate((ms) => new Promise<any[]>((resolve) => {
      const out: any[] = [];
      const t0 = performance.now();
      const step = (now: number) => {
        const clone = document.querySelector<HTMLElement>('.zoom-clone[data-zoom-id="scrolled-2"]');
        if (clone) {
          const cut = (clone.parentElement as HTMLElement).style.clipPath.match(/inset\(([-\d.]+)px/);
          out.push({ box: (window as any).cloneVisible(clone), cutTop: cut ? +cut[1] : null });
        }
        if (now - t0 < ms) requestAnimationFrame(step); else resolve(out);
      };
      requestAnimationFrame(step);
    }), ms);
  const opening = trace(400);
  await page.click('[data-tile="scrolled-2"] .tile-title');
  const first = (await opening)[0];
  expect(first.cutTop).toBeGreaterThanOrEqual(59); // nothing above the header line shows
  expect(Math.abs(first.box.y - source.y)).toBeLessThanOrEqual(1); // the copy is the whole thumbnail, cut, not shortened
  expect(first.box.radii).toEqual([14, 14, 14, 14]); // its own rounded corners, not new ones at the cut
  await expect.poll(() => phase(page), { timeout: 12000 }).toBe("open");
  const closing = trace(3500);
  await page.keyboard.press("Escape");
  const last = (await closing).at(-1);
  expect(last.cutTop).toBeGreaterThanOrEqual(59);
  expect(Math.abs(last.box.y - source.y) + Math.abs(last.box.h - source.h)).toBeLessThanOrEqual(2); // lands at full height
});

test("plain-HTML sources added after the page loaded zoom too", async ({ page }) => {
  await page.goto(pathToFileURL(join(dist, "template.html")).href);
  await page.addScriptTag({ content: PAGE_HELPERS });
  await page.evaluate(() => {
    const li = document.querySelector(".tiles li")!.cloneNode(true) as HTMLElement;
    li.querySelector("a")!.dataset.tile = "t-new";
    li.querySelector<HTMLElement>("[data-zoom-source]")!.dataset.zoomSource = "t-new";
    document.querySelector(".tiles")!.appendChild(li);
  });
  await page.waitForTimeout(100);
  await page.click('[data-tile="t-new"]');
  await expect.poll(() => phase(page)).toBe("open");
  expect(await activeId(page)).toBe("t-new");
});

test("after landing, a detail photo still downloading shows the thumbnail's picture in the card until it arrives", async ({ page, context }) => {
  let release: () => void = () => {};
  const arrived = new Promise<void>((r) => (release = r));
  await context.route("http://demo.test/**", async (route) => {
    const p = new URL(route.request().url()).pathname;
    if (p === "/") return route.fulfill({ contentType: "text/html", body: readFileSync(join(dist, "test.html"), "utf8") });
    if (p === "/app.js") return route.fulfill({ contentType: "text/javascript", body: readFileSync(join(dist, "app.js"), "utf8") });
    await arrived; // held until the test lets the photos through
    return route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="1600" height="1000" fill="#7aa"/></svg>' });
  });
  await page.goto("http://demo.test/?" + encodeURIComponent(JSON.stringify({ scenario: "late", lateUrl: "http://demo.test/img" })));
  await page.addScriptTag({ content: PAGE_HELPERS });
  await page.click('[data-tile="late-2"]');
  await expect.poll(() => phase(page), { timeout: 5000 }).toBe("open");
  const bg = () => page.evaluate(() => getComputedStyle(document.querySelector('.zoom-card[data-zoom-id="late-2"] [data-zoom-hero] img')!).backgroundImage.slice(0, 24));
  expect(await bg()).toBe('url("data:image/svg+xml;');
  release();
  await expect.poll(bg, { timeout: 5000 }).toBe("none"); // the photo has arrived and taken over
});

test("an address of your own on this page (#/walks/id) works like the default: shared links open the card, closing clears it", async ({ page }) => {
  await page.goto(url({ scenario: "rapid", historyPrefix: "#/walks/" }) + "#/walks/rapid-3");
  await page.addScriptTag({ content: PAGE_HELPERS });
  await expect.poll(() => phase(page), { timeout: 3000 }).toBe("open");
  expect(await activeId(page)).toBe("rapid-3");
  await page.keyboard.press("Escape");
  await expect.poll(() => clean(page)).toMatchObject({ phase: "idle", clones: 0, hidden: 0, inert: 0 });
  expect(new URL(page.url()).hash).toBe("");
  await page.click('[data-tile="rapid-2"]');
  await expect.poll(() => new URL(page.url()).hash).toBe("#/walks/rapid-2");
});

test("a sideways strip that reaches its end: that swipe's momentum doesn't turn the page, a new swipe does (no pause or mouse move needed)", async ({ page }) => {
  await open(page, { scenario: "hscroll" });
  await page.click('[data-tile="hscroll-2"]');
  await expect.poll(() => phase(page)).toBe("open");
  const r = await page.evaluate(() => {
    const s = document.querySelector<HTMLElement>('.zoom-card:not([inert]) [data-strip]')!;
    s.scrollIntoView({ block: "center" });
    s.scrollLeft = s.scrollWidth - s.clientWidth - 40; // 40 px from its end
    const b = s.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  });
  await page.mouse.move(r.x, r.y);
  const atEnd = () => page.evaluate(() => { const s = document.querySelector<HTMLElement>('[data-zoom-id="hscroll-2"] [data-strip]')!; return s.scrollWidth - s.clientWidth - s.scrollLeft; });
  for (const d of [20, 30]) await page.mouse.wheel(d, 0); // reaches the end
  await expect.poll(atEnd).toBeLessThanOrEqual(1);
  for (const d of [35, 28, 20, 14, 9, 6, 4, 3, 2]) await page.mouse.wheel(d, 0); // the swipe's momentum
  await page.waitForTimeout(100);
  expect(await activeId(page)).toBe("hscroll-2");
  for (const d of [8, 20, 40, 50]) await page.mouse.wheel(d, 0); // a new swipe, mouse unmoved
  await expect.poll(() => activeId(page)).toBe("hscroll-3");
});

test.describe('presentation "scroll" (one continuous vertical column)', () => {
  const cfg = { scenario: "grid", props: { presentation: "scroll" }, timeScale: 0.5 };
  const srcOpacity = (page: Page, id: string) => page.evaluate((id) => +getComputedStyle(document.querySelector(`[data-zoom-react-source="${id}"]`)!).opacity, id);

  test("only the tapped item grows; the rest of the group dims to 0.2 with the flight; the tapped one is left empty", async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await open(page, cfg);
    const rec = page.evaluate(() => new Promise<any[]>((resolve) => {
      const out: any[] = [];
      const t0 = performance.now();
      const step = (now: number) => {
        out.push([...document.querySelectorAll<HTMLElement>(".zoom-card")].map((c) => ({ id: c.dataset.zoomId, w: c.getBoundingClientRect().width, o: +getComputedStyle(c).opacity })));
        if (now - t0 < 1500) requestAnimationFrame(step); else resolve(out);
      };
      requestAnimationFrame(step);
    }));
    await page.click('[data-tile="grid-5"]');
    const frames = await rec;
    const full = frames.at(-1).find((c: any) => c.id === "grid-5").w;
    // The neighbours never change size; the tapped card starts small.
    for (const f of frames) for (const c of f) if (c.id !== "grid-5" && c.o > 0) expect(Math.abs(c.w - full)).toBeLessThan(1);
    expect(frames.find((f) => f.some((c: any) => c.id === "grid-5" && c.o > 0))!.find((c: any) => c.id === "grid-5").w).toBeLessThan(full * 0.6);
    await expect.poll(() => phase(page), { timeout: 12000 }).toBe("open");
    expect(await srcOpacity(page, "grid-2")).toBeCloseTo(0.2, 2);
    expect(await page.evaluate(() => document.querySelector('[data-zoom-react-source="grid-5"]')!.hasAttribute("data-zoom-hidden"))).toBe(true);
  });

  test("scrolling on to the next item swaps which thumbnail is empty; closing flies only that card home, the rest shrink and fade", async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await open(page, cfg);
    await page.click('[data-tile="grid-5"]');
    await expect.poll(() => phase(page), { timeout: 12000 }).toBe("open");
    await expect.poll(() => page.evaluate(() => document.querySelectorAll(".zoom-card").length), { timeout: 4000 }).toBe(9);
    // Scroll the column so grid-6's card is the one being read.
    await page.evaluate(() => {
      const sc = document.querySelector<HTMLElement>(".zoom-stream")!;
      const c = document.querySelector<HTMLElement>('.zoom-card[data-zoom-id="grid-6"]')!;
      sc.scrollTop = c.offsetTop - 40;
    });
    await expect.poll(() => page.evaluate(() => (window as any).phase() === "open" && document.querySelector(".zoom-root")!.getAttribute("aria-label"))).toBe("Glacier Tongue");
    await expect.poll(() => srcOpacity(page, "grid-6"), { timeout: 4000 }).toBeLessThan(0.02);
    await expect.poll(() => srcOpacity(page, "grid-5"), { timeout: 4000 }).toBeCloseTo(0.2, 2);
    const target = await page.evaluate(() => (window as any).src("grid-6"));
    const rec = page.evaluate(() => new Promise<any[]>((resolve) => {
      const out: any[] = [];
      const t0 = performance.now();
      const step = (now: number) => {
        const n = document.querySelector<HTMLElement>('.zoom-card[data-zoom-id="grid-7"]');
        out.push({ clone: (window as any).cloneVisible(document.querySelector('.zoom-clone[data-zoom-id="grid-6"]')), neighbourScale: n ? new DOMMatrix(getComputedStyle(n).transform).a : null });
        if (now - t0 < 2500) requestAnimationFrame(step); else resolve(out);
      };
      requestAnimationFrame(step);
    }));
    await page.keyboard.press("Escape");
    const frames = await rec;
    const flying = frames.filter((f) => f.clone && f.clone.w !== undefined);
    const landed = flying.at(-1).clone;
    expect(Math.abs(landed.x - target.x) + Math.abs(landed.y - target.y) + Math.abs(landed.w - target.w)).toBeLessThanOrEqual(3);
    expect(Math.min(...frames.map((f) => f.neighbourScale ?? 1))).toBeLessThan(0.97); // shrinks in place, doesn't fly
    expect(await page.evaluate(() => document.querySelectorAll('.zoom-clone:not([data-zoom-id="grid-6"])').length)).toBe(0);
    await expect.poll(() => clean(page), { timeout: 6000 }).toMatchObject({ phase: "idle", clones: 0, hidden: 0, dimmed: 0, inert: 0 });
    expect(await srcOpacity(page, "grid-2")).toBe(1);
  });

  test("cards added above the one being read after landing don't move it", async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await open(page, { ...cfg, timeScale: 1 });
    await page.click('[data-tile="grid-5"]');
    await expect.poll(() => phase(page)).toBe("open");
    const top = () => page.evaluate(() => document.querySelector('.zoom-card[data-zoom-id="grid-5"]')!.getBoundingClientRect().top);
    const before = await top();
    await expect.poll(() => page.evaluate(() => document.querySelectorAll(".zoom-card").length), { timeout: 4000 }).toBe(9);
    await page.waitForTimeout(100);
    expect(Math.abs((await top()) - before)).toBeLessThanOrEqual(1);
  });
});

// Turning a close around used to stop fast-moving cards dead. Watching frames can't pin this down
// reliably on a busy test machine (uneven frame timing looks the same), so these test its two
// causes directly.
test.describe("speeds carried into a turn-around (the two causes of cards stopping dead)", () => {
  test("the library reads speeds only through velocityOf (Motion's getVelocity drops to 0 after 30 ms)", async () => {
    const { readdirSync } = await import("node:fs");
    const src = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..", "src", "zoom");
    const offenders = readdirSync(src)
      .filter((f) => /\.(ts|tsx)$/.test(f) && f !== "springs.ts")
      .filter((f) => readFileSync(join(src, f), "utf8").includes(".getVelocity("));
    expect(offenders).toEqual([]);
  });

  test("a value's speed is still known after a slow frame (Motion's own reading drops to 0 after 30 ms)", async ({ page }) => {
    await open(page, { scenario: "grid" });
    const r = await page.evaluate(() => new Promise<{ ours: number; motion: number }>((resolve) => {
      const { velocityOf, motionValue } = (window as any).__zoomInternals;
      const v = motionValue(0);
      v.set(1);
      setTimeout(() => v.set(11), 16); // 10 px in 16 ms: 625 px/s
      setTimeout(() => resolve({ ours: velocityOf(v), motion: v.getVelocity() }), 16 + 45); // the next frame is 45 ms late
    }));
    expect(r.motion).toBe(0); // why the library doesn't use it
    expect(r.ours).toBeGreaterThan(400);
    expect(r.ours).toBeLessThan(900);
  });

  test("a spring started in slow motion keeps the speed it was given", async ({ page }) => {
    await open(page, { scenario: "grid" });
    const speed = await page.evaluate(() => new Promise<number>((resolve) => {
      const { springTo, motionValue } = (window as any).__zoomInternals;
      const v = motionValue(0);
      // Already at its target, so only the speed it was given moves it (2000 px/s, in real time).
      springTo(v, 0, { duration: 0.5, bounce: 0 }, { velocity: 2000, speed: 0.1 });
      const samples: [number, number][] = [];
      const step = (t: number) => {
        samples.push([t, v.get()]);
        if (samples.length < 8) requestAnimationFrame(step);
        else resolve(((samples[7][1] - samples[2][1]) / (samples[7][0] - samples[2][0])) * 1000);
      };
      requestAnimationFrame(step);
    }));
    expect(speed).toBeGreaterThan(1000); // was ~200 px/s: the speed was handed to the slowed spring unconverted
    expect(speed).toBeLessThan(2600);
  });
});
