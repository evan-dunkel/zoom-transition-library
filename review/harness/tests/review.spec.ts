/**
 * Browser checks behind the review (review/review-report.md). Each test states the
 * behaviour a user should get. Tests marked test.fail() document a confirmed bug:
 * they are EXPECTED to fail today, and Playwright reports them as passing for that
 * reason. Once a bug is fixed, its test starts "unexpectedly passing": remove the
 * test.fail() line then.
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

test.describe("works correctly today", () => {
  for (const [name, cfg, id, scroll, vp] of [
    ["top of page", { scenario: "grid" }, "grid-2", 0, undefined],
    ["scrolled page", { scenario: "scrolled" }, "scrolled-2", 700, undefined],
    ["phone width", { scenario: "mobile" }, "mobile-3", 0, { width: 390, height: 780 }],
  ] as const) {
    test(`hero leaves exactly from the source and lands exactly on its spot (${name})`, async ({ page }) => {
      if (vp) await page.setViewportSize(vp);
      await open(page, cfg);
      await page.evaluate((y) => scrollTo(0, y), scroll);
      const f = await flight(page, id);
      near(f.first, f.before);
      near(f.last, f.hero);
    });
  }

  test("reduced motion: cross-fade only, nothing moves", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page, { scenario: "grid" });
    const rec = page.evaluate(() => (window as any).record("grid-2", 1200));
    await page.click('[data-tile="grid-2"]');
    const frames: any[] = await rec;
    expect(frames.filter((f) => f.clone).length).toBe(0);
    expect(new Set(frames.filter((f) => f.card).map((f) => JSON.stringify(f.card))).size).toBe(1);
  });

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

  test("rapid clicks, Esc/Back mid-flight and random input leave nothing behind", async ({ page }) => {
    test.setTimeout(120_000);
    await open(page, { scenario: "rapid" });
    const names = ["Double-click a card", "Click 8 times fast (two cards)", "Open, then Esc halfway", "Open, then browser Back halfway", "Close, then tap the card as it flies home", "Open, then arrow keys quickly", "Chaos: 25 random actions"];
    for (const n of names) {
      await page.evaluate((n) => [...document.querySelectorAll<HTMLButtonElement>(".tester-buttons button")].find((b) => b.textContent === n)!.click(), n);
      await page.waitForFunction(() => /finished/.test(document.querySelector(".tester-log")!.textContent!), null, { timeout: 30_000 });
      if ((await phase(page)) === "open") await page.keyboard.press("Escape");
      await expect.poll(() => clean(page), { timeout: 5000 }).toMatchObject({ phase: "idle", clones: 0, hidden: 0, htmlOverflow: "", cards: 0 });
    }
  });
});

test.describe("confirmed bugs (expected to fail until fixed)", () => {
  test("CRITICAL: a hero image that has not loaded yet must not freeze the page", async ({ page, context }) => {
    test.fail();
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
  });

  test("resizing the window while a card is opening still fits the card to the window", async ({ page }) => {
    test.fail();
    await open(page, { scenario: "grid" });
    await page.click('[data-tile="grid-1"]');
    await page.waitForTimeout(120);
    await page.setViewportSize({ width: 600, height: 800 });
    await expect.poll(() => phase(page)).toBe("open");
    const r = await page.evaluate(() => (window as any).card("grid-1").getBoundingClientRect().right);
    expect(r).toBeLessThanOrEqual(600);
  });

  test("the flying copy keeps the thumbnail's rounded corners at take-off", async ({ page }) => {
    test.fail();
    await open(page, { scenario: "grid" });
    const f = await flight(page, "grid-2");
    expect(f.first.cornerRadiusPx).toBeCloseTo(14, 0);
  });

  test("keyboard focus stays inside the open card (Tab does not reach the hidden page)", async ({ page }) => {
    test.fail();
    await open(page, { scenario: "keyboard" });
    await page.click('[data-tile="keyboard-2"]');
    await expect.poll(() => phase(page)).toBe("open");
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => !!document.activeElement?.closest(".zoom-root"))).toBe(true);
    }
  });

  test("arrow keys in a text field move the cursor instead of switching cards", async ({ page }) => {
    test.fail();
    await open(page, { scenario: "keyboard" });
    await page.click('[data-tile="keyboard-2"]');
    await expect.poll(() => phase(page)).toBe("open");
    await page.evaluate(() => document.querySelector<HTMLInputElement>(".zoom-card:not([inert]) input")!.focus());
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => document.querySelector<HTMLElement>(".zoom-card:not([inert])")!.dataset.zoomId)).toBe("keyboard-2");
  });

  test("text in an open card can be selected and copied", async ({ page }) => {
    test.fail();
    await open(page, { scenario: "grid" });
    await page.click('[data-tile="grid-2"]');
    await expect.poll(() => phase(page)).toBe("open");
    expect(await page.evaluate(() => getComputedStyle(document.querySelector(".zoom-card:not([inert]) .detail-body p")!).userSelect)).not.toBe("none");
  });

  test("screen readers get a named dialog or an announcement when a card opens", async ({ page }) => {
    test.fail();
    await open(page, { scenario: "grid" });
    await page.click('[data-tile="grid-2"]');
    await expect.poll(() => phase(page)).toBe("open");
    const a = await page.evaluate(() => {
      const root = document.querySelector(".zoom-root")!;
      return { name: root.getAttribute("aria-label") || root.getAttribute("aria-labelledby"), live: document.querySelector(".zoom-sr")!.textContent };
    });
    expect(a.name || a.live).toBeTruthy();
  });

  test("a shared or reloaded #id link reopens that card", async ({ page }) => {
    test.fail();
    await page.goto(url({ scenario: "rapid" }) + "#rapid-3");
    await page.addScriptTag({ content: PAGE_HELPERS });
    await expect.poll(() => phase(page), { timeout: 3000 }).toBe("open");
  });

  test("turning on reduced motion while the page is open takes effect without a reload", async ({ page }) => {
    test.fail();
    await open(page, { scenario: "grid" });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const rec = page.evaluate(() => (window as any).record("grid-2", 1000));
    await page.click('[data-tile="grid-2"]');
    expect((await rec).filter((f: any) => f.clone).length).toBe(0);
  });

  test("if saving browser history fails, closing does not navigate the visitor off the site", async ({ page }) => {
    test.fail();
    await page.goto("data:text/html,<p>previous site</p>");
    // An embedded (srcdoc) frame: pushState throws there.
    await page.goto(pathToFileURL(join(dist, "test.html")).href);
    await page.evaluate(() => {
      document.body.innerHTML = "";
      const f = document.createElement("iframe");
      f.style.cssText = "width:1100px;height:700px";
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

  test("a card whose source vanished (hidden by a responsive layout) fades instead of flying to the screen corner", async ({ page }) => {
    test.fail();
    await open(page, { scenario: "grid" });
    await page.click('[data-tile="grid-2"]');
    await expect.poll(() => phase(page)).toBe("open");
    await page.evaluate(() => ((document.querySelector('[data-tile="grid-2"]')!.closest("li") as HTMLElement).style.display = "none"));
    const rec = page.evaluate(() => (window as any).record("grid-2", 1500));
    await page.keyboard.press("Escape");
    const last = (await rec).filter((f: any) => f.clone).at(-1).clone;
    expect(last.x > 5 || last.y > 5).toBe(true);
  });

  test("TemplateDestination does not run inline event handlers from template HTML", async ({ page }) => {
    test.fail();
    await page.goto(pathToFileURL(join(dist, "template.html")).href);
    await page.click('[data-tile="t-2"]');
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => (window as any).__xss ?? 0)).toBe(0);
  });
});
