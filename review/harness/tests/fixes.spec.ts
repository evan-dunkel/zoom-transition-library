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

test("a thumbnail half under a sticky header: its flying picture never covers the header", async ({ page }) => {
  await open(page, { scenario: "scrolled", timeScale: 0.2 });
  await page.evaluate(() => {
    const t = document.querySelector('[data-zoom-react-source="scrolled-2"]')!.getBoundingClientRect();
    scrollBy(0, t.top - 60 + t.height / 2); // the header is 60px tall
  });
  await page.waitForTimeout(150);
  const rec = page.evaluate(() => (window as any).record("scrolled-2", 300));
  await page.click('[data-tile="scrolled-2"] .tile-title');
  const first = ((await rec) as any[]).find((f) => f.clone && f.clone.w !== undefined).clone;
  expect(first.y).toBeGreaterThanOrEqual(59);
});

test("turning a close around in slow motion carries each card's speed (no card stops dead)", async ({ page }) => {
  await open(page, { scenario: "rapid", timeScale: 0.1 });
  const rec = page.evaluate(() => new Promise<any[]>((resolve) => {
    const out: any[] = [];
    const t0 = performance.now();
    const step = (now: number) => {
      out.push({ t: now - t0, cards: [...document.querySelectorAll<HTMLElement>(".zoom-card")].map((c) => ({ id: c.dataset.zoomId, x: c.getBoundingClientRect().left })) });
      if (now - t0 < 5000) requestAnimationFrame(step); else resolve(out);
    };
    requestAnimationFrame(step);
  }));
  await page.click('[data-tile="rapid-2"]');
  await page.waitForTimeout(2500);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1000);
  const at = await page.evaluate(() => { const r = document.querySelector('.zoom-card[data-zoom-id="rapid-2"]')!.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 30 }; });
  await page.mouse.click(at.x, at.y);
  const frames = await rec;
  // "Stopping dead": a card on screen moving fast (over 0.8 px/ms, even at this speed) that then
  // averages under a tenth of that speed over the next 60 ms or more. Speeds are per millisecond and
  // averaged, so uneven frame timing on a busy machine doesn't count.
  const xAt = (k: number, id: string) => frames[k]?.cards.find((d: any) => d.id === id)?.x as number | undefined;
  let stops = 0;
  for (let i = 1; i < frames.length; i++) {
    for (const c of frames[i].cards) {
      const p = xAt(i - 1, c.id);
      if (p === undefined || c.x < -400 || c.x > 1200) continue;
      const before = (c.x - p) / (frames[i].t - frames[i - 1].t);
      let k = i + 1;
      while (k < frames.length && frames[k].t - frames[i].t < 60) k++;
      const later = xAt(k, c.id);
      if (later === undefined || Math.abs(before) <= 0.8) continue;
      if (Math.abs(later - c.x) / (frames[k].t - frames[i].t) < Math.abs(before) / 10) stops++;
    }
  }
  expect(stops).toBe(0);
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
