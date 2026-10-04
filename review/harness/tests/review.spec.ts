/**
 * Browser checks behind the review (review/review-report.md). Each test states the
 * behaviour a user should get. The few marked test.fail() are known limitations that
 * are EXPECTED to fail (Playwright counts them as passing for that reason); if one
 * starts "unexpectedly passing", remove its test.fail() line.
 *
 * Run: npm run build && npx playwright test   (from review/harness)
 */
import { test, expect, type Page } from "@playwright/test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import { PAGE_HELPERS } from "../probes/lib.mjs";

const dist = join(fileURLToPath(new URL(".", import.meta.url)), "..", "dist");
const url = (cfg: object) => pathToFileURL(join(dist, "test.html")).href + "?" + encodeURIComponent(JSON.stringify(cfg));

async function open(page: Page, cfg: object) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url(cfg));
  await page.addScriptTag({ content: PAGE_HELPERS });
  return errors;
}
const phase = (page: Page) => page.evaluate(() => (window as any).phase());
const clean = (page: Page) => page.evaluate(() => (window as any).clean());
const near = (a: any, b: any, tol = 1) =>
  expect(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.w - b.w), Math.abs(a.h - b.h))).toBeLessThanOrEqual(tol);

async function flight(page: Page, id: string) {
  const before = await page.evaluate((id) => (window as any).src(id), id);
  const rec = page.evaluate((id) => (window as any).record(id, 2000), id);
  await page.click(`[data-tile="${id}"]`, { force: true });
  const frames: any[] = await rec;
  const withClone = frames.filter((f) => f.clone && f.clone.w !== undefined);
  return { before, first: withClone[0].clone, last: withClone.at(-1).clone, hero: frames.at(-1).hero };
}

test.describe("geometry", () => {
  for (const [name, cfg, id, scroll, vp] of [
    ["top of page", { scenario: "grid" }, "grid-2", 0, undefined],
    ["scrolled page", { scenario: "scrolled" }, "scrolled-2", 700, undefined],
    ["phone width", { scenario: "mobile" }, "mobile-3", 0, { width: 390, height: 780 }],
    ["portfolio, image inset in the card", { scenario: "portfolio" }, "portfolio-2", 0, { width: 1400, height: 900 }],
    ["portfolio, phone", { scenario: "portfolio" }, "portfolio-2", 0, { width: 390, height: 800 }],
  ] as const) {
    test(`hero leaves exactly from the source and lands exactly on its spot (${name})`, async ({ page }) => {
      if (vp) await page.setViewportSize(vp);
      await open(page, cfg);
      if (scroll) await page.evaluate((y) => scrollTo(0, y), scroll);
      else await page.evaluate((id) => document.querySelector(`[data-tile="${id}"]`)!.scrollIntoView({ block: "center" }), id);
      const f = await flight(page, id);
      near(f.first, f.before);
      near(f.last, f.hero);
    });
  }

  test("corners blend from the thumbnail's radius to the hero's, with no pop", async ({ page }) => {
    await open(page, { scenario: "grid" });
    const f = await flight(page, "grid-2");
    expect(f.first.cornerRadiusPx).toBeCloseTo(14, 0); // the thumbnail's 14px
    expect(f.last.cornerRadiusPx).toBeCloseTo(0, 0); // the hero's square corners
  });

  test("an inset hero with its own radius keeps it the whole way (portfolio)", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await open(page, { scenario: "portfolio" });
    const f = await flight(page, "portfolio-1");
    expect(f.first.cornerRadiusPx).toBeCloseTo(14, 0);
    expect(f.last.cornerRadiusPx).toBeCloseTo(14, 0);
  });

  test("resizing the window while a card is opening still fits the card to the window", async ({ page }) => {
    await open(page, { scenario: "grid" });
    await page.click('[data-tile="grid-1"]');
    await page.waitForTimeout(120);
    await page.setViewportSize({ width: 600, height: 800 });
    await expect.poll(() => phase(page)).toBe("open");
    await expect.poll(() => page.evaluate(() => (window as any).card("grid-1").getBoundingClientRect().right)).toBeLessThanOrEqual(600);
  });

  test("a card whose source vanished (hidden by a responsive layout) fades instead of flying to the screen corner", async ({ page }) => {
    await open(page, { scenario: "grid" });
    await page.click('[data-tile="grid-2"]');
    await expect.poll(() => phase(page)).toBe("open");
    await page.evaluate(() => ((document.querySelector('[data-tile="grid-2"]')!.closest("li") as HTMLElement).style.display = "none"));
    const rec = page.evaluate(() => (window as any).record("grid-2", 1200));
    await page.keyboard.press("Escape");
    const frames: any[] = await rec;
    // No flying copy heads for the corner, and the card itself never moves toward it.
    expect(frames.filter((f) => f.clone && f.clone.x < 5 && f.clone.y < 5).length).toBe(0);
    expect(frames.filter((f) => f.card && f.card.x < 5 && f.card.y < 5).length).toBe(0);
    await expect.poll(() => clean(page)).toMatchObject({ phase: "idle", clones: 0, hidden: 0 });
  });
});

test.describe("robustness", () => {
  test("a hero image that hasn't downloaded yet doesn't freeze the page", async ({ page, context }) => {
    await context.route("http://demo.test/**", async (route) => {
      const p = new URL(route.request().url()).pathname;
      if (p === "/") return route.fulfill({ contentType: "text/html", path: join(dist, "test.html") });
      if (p === "/app.js") return route.fulfill({ contentType: "text/javascript", path: join(dist, "app.js") });
      await new Promise((r) => setTimeout(r, 900));
      return route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="1600" height="1000" fill="#7aa"/></svg>' });
    });
    await page.goto("http://demo.test/?" + encodeURIComponent(JSON.stringify({ scenario: "late", lateUrl: "http://demo.test/img" })));
    await page.addScriptTag({ content: PAGE_HELPERS });
    await page.click('[data-tile="late-1"]');
    await expect.poll(() => phase(page), { timeout: 4000 }).toBe("open");
    await page.keyboard.press("Escape");
    await expect.poll(() => clean(page), { timeout: 4000 }).toMatchObject({ phase: "idle", clones: 0, hidden: 0, htmlOverflow: "", inert: 0 });
  });

  test("rapid clicks, Esc/Back mid-flight and random input leave nothing behind", async ({ page }) => {
    test.setTimeout(120_000);
    await open(page, { scenario: "rapid" });
    const names = ["Double-click a card", "Click 8 times fast (two cards)", "Open, then Esc halfway", "Open, then browser Back halfway", "Close, then tap the card as it flies home", "Open, then arrow keys quickly", "Chaos: 25 random actions"];
    for (const n of names) {
      await page.evaluate((n) => [...document.querySelectorAll<HTMLButtonElement>(".tester-buttons button")].find((b) => b.textContent === n)!.click(), n);
      await page.waitForFunction(() => /finished/.test(document.querySelector(".tester-log")!.textContent!), null, { timeout: 30_000 });
      if ((await phase(page)) === "open") await page.keyboard.press("Escape");
      await expect.poll(() => clean(page), { timeout: 5000 }).toMatchObject({ phase: "idle", clones: 0, hidden: 0, htmlOverflow: "", cards: 0, inert: 0 });
    }
  });

  test("if saving browser history fails, closing does not navigate the visitor off the site", async ({ page }) => {
    await page.goto("data:text/html,<p>previous site</p>");
    await page.goto(pathToFileURL(join(dist, "test.html")).href);
    await page.evaluate(() => {
      document.body.innerHTML = "";
      const f = document.createElement("iframe");
      f.style.cssText = "width:1100px;height:700px";
      // srcdoc frames refuse pushState.
      f.srcdoc = '<!doctype html><div id="app"></div><script>window.ZOOM_DEMO={"scenario":"rapid"}<\/script><script src="app.js"><\/script>';
      document.body.appendChild(f);
    });
    const frame = page.frameLocator("iframe");
    await frame.locator('[data-tile="rapid-1"]').click();
    await page.waitForTimeout(1200);
    await frame.locator("body").press("Escape").catch(() => {});
    await page.waitForTimeout(1200);
    expect(page.url()).toContain("test.html");
  });
});

test.describe("reduced motion", () => {
  test("opening and closing are instant: nothing moves and nothing fades", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page, { scenario: "grid" });
    const rec = page.evaluate(() => (window as any).record("grid-2", 600));
    await page.click('[data-tile="grid-2"]');
    const frames: any[] = await rec;
    const shown = frames.filter((f) => f.card);
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.every((f) => f.phase === "open")).toBe(true); // never seen mid-transition
    expect(new Set(shown.map((f) => JSON.stringify(f.card))).size).toBe(1);
    expect(new Set(shown.map((f) => f.zoomerOpacity))).toEqual(new Set(["1"]));
    expect(frames.filter((f) => f.clone).length).toBe(0);
    await page.keyboard.press("Escape");
    expect(await clean(page)).toMatchObject({ phase: "idle", cards: 0 }); // closed in the same task
  });

  test("turning reduced motion on while the page is open takes effect without a reload", async ({ page }) => {
    await open(page, { scenario: "grid" });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const rec = page.evaluate(() => (window as any).record("grid-2", 600));
    await page.click('[data-tile="grid-2"]');
    expect((await rec).filter((f: any) => f.clone).length).toBe(0);
  });
});

test.describe("keyboard, screen readers, text", () => {
  test("focus goes to Close on open and back to the card on close", async ({ page }) => {
    await open(page, { scenario: "grid" });
    await page.focus('[data-tile="grid-2"]');
    await page.keyboard.press("Enter");
    await expect.poll(() => phase(page)).toBe("open");
    expect(await page.evaluate(() => document.activeElement?.className)).toBe("zoom-close");
    await page.keyboard.press("Escape");
    await expect.poll(() => phase(page)).toBe("idle");
    expect(await page.evaluate(() => (document.activeElement as HTMLElement)?.dataset.tile)).toBe("grid-2");
  });

  test("Tab never reaches the hidden page behind an open card", async ({ page }) => {
    await open(page, { scenario: "keyboard" });
    await page.click('[data-tile="keyboard-2"]');
    await expect.poll(() => phase(page)).toBe("open");
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      // Either inside the card, or on the browser's own stop past the end of the page (BODY), as with a native dialog.
      expect(await page.evaluate(() => !!document.activeElement?.closest(".zoom-root") || document.activeElement === document.body)).toBe(true);
    }
  });

  test("arrow keys in a text field move the cursor instead of switching cards", async ({ page }) => {
    await open(page, { scenario: "keyboard" });
    await page.click('[data-tile="keyboard-2"]');
    await expect.poll(() => phase(page)).toBe("open");
    await page.evaluate(() => document.querySelector<HTMLInputElement>(".zoom-card:not([inert]) input")!.focus());
    await page.keyboard.press("End");
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => document.querySelector<HTMLElement>(".zoom-card:not([inert])")!.dataset.zoomId)).toBe("keyboard-2");
    expect(await page.evaluate(() => (document.activeElement as HTMLInputElement).selectionStart)).toBeGreaterThan(0);
  });

  test("the open card is a named dialog", async ({ page }) => {
    await open(page, { scenario: "grid" });
    await page.click('[data-tile="grid-2"]');
    await expect.poll(() => phase(page)).toBe("open");
    expect(await page.evaluate(() => document.querySelector(".zoom-root")!.getAttribute("aria-label"))).toBe("The Long Ridge");
  });

  test("text in an open card can be selected with the mouse, and a mouse drag doesn't close the card", async ({ page }) => {
    await open(page, { scenario: "grid" });
    await page.click('[data-tile="grid-2"]');
    await expect.poll(() => phase(page)).toBe("open");
    const p = await page.evaluate(() => {
      const r = document.querySelector(".zoom-card:not([inert]) .detail-body p")!.getBoundingClientRect();
      return { x: r.left + 4, y: r.top + 8, x2: r.left + 300, y2: r.top + 40 };
    });
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(p.x2, p.y2, { steps: 10 });
    await page.mouse.move(p.x2, p.y2 + 300, { steps: 10 }); // well past where a drag used to dismiss
    await page.mouse.up();
    await page.waitForTimeout(700);
    expect(await phase(page)).toBe("open");
    expect((await page.evaluate(() => getSelection()!.toString())).length).toBeGreaterThan(10);
  });
});

test.describe("touch", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 800 } });
  test("dragging the card down from its top with a finger closes it", async ({ page }) => {
    await open(page, { scenario: "mobile" });
    await page.click('[data-tile="mobile-2"]');
    await expect.poll(() => phase(page)).toBe("open");
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: string, y: number) =>
      cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x: 195, y }] });
    await touch("touchStart", 200);
    for (let y = 205; y <= 460; y += 15) await touch("touchMove", y);
    await touch("touchEnd", 460);
    await expect.poll(() => phase(page), { timeout: 3000 }).toBe("idle");
  });
});

test.describe("known limitations (expected to fail)", () => {
  test("a shared or reloaded #id link reopens that card (needs real pages per item instead; see report)", async ({ page }) => {
    test.fail();
    await page.goto(url({ scenario: "rapid" }) + "#rapid-3");
    await page.addScriptTag({ content: PAGE_HELPERS });
    await expect.poll(() => phase(page), { timeout: 3000 }).toBe("open");
  });

  test("TemplateDestination does not run inline event handlers from template HTML (documented: trusted markup only)", async ({ page }) => {
    test.fail();
    await page.goto(pathToFileURL(join(dist, "template.html")).href);
    await page.click('[data-tile="t-2"]');
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => (window as any).__xss ?? 0)).toBe(0);
  });
});
