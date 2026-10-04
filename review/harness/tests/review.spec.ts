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

/** Mean per-channel difference (0-255) between two PNG screenshots, computed in the page. */
const pixelDiff = (page: Page, a: Buffer, b: Buffer) =>
  page.evaluate(async ([a, b]) => {
    const load = (src: string) => new Promise<HTMLImageElement>((r) => { const i = new Image(); i.onload = () => r(i); i.src = "data:image/png;base64," + src; });
    const px = (img: HTMLImageElement) => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d")!; x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
    const [da, db] = (await Promise.all([load(a), load(b)])).map(px);
    let sum = 0;
    for (let i = 0; i < da.length; i += 4) sum += Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
    return sum / (da.length / 4) / 3;
  }, [a.toString("base64"), b.toString("base64")]);

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

  test("an inset hero with its own radius keeps it the whole way (portfolio)", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await open(page, { scenario: "portfolio" });
    const f = await flight(page, "portfolio-1");
    expect(f.first.cornerRadiusPx).toBeCloseTo(14, 0);
    expect(f.last.cornerRadiusPx).toBeCloseTo(14, 0);
  });

  test("an edge-to-edge hero takes the card's rounded corners where it meets them (no pop on landing)", async ({ page }) => {
    await open(page, { scenario: "grid" });
    const f = await flight(page, "grid-2");
    expect(f.first.radii).toEqual([14, 14, 14, 14]); // the thumbnail
    expect(f.last.radii).toEqual([28, 28, 0, 0]); // top corners clipped by the 28px card, bottom square
  });

  for (const [name, scenario, id, vp] of [
    ["4:3 thumbnail into a 16:10 hero", "grid", "grid-2", { width: 1400, height: 900 }],
    ["square thumbnail into a 16:10 hero", "mobile", "mobile-2", { width: 390, height: 800 }],
  ] as const) {
    test(`the first flying frame looks exactly like the thumbnail; the crop changes smoothly from there (${name})`, async ({ page }) => {
      await page.setViewportSize(vp);
      await open(page, { scenario, timeScale: 0.02 });
      const r = await page.evaluate((id) => (window as any).src(id), id);
      const clip = { x: r.x + 2, y: r.y + 2, width: r.w - 4, height: r.h - 4 };
      const before = await page.screenshot({ clip });
      await page.click(`[data-tile="${id}"]`);
      await page.waitForTimeout(60);
      const after = await page.screenshot({ clip });
      // Mean per-channel difference, 0-255. The library as received measured about 9 here.
      expect(await pixelDiff(page, before, after)).toBeLessThan(1.5);
      expect(await page.evaluate((id) => "zoomFill" in document.querySelector<HTMLElement>(`.zoom-clone[data-zoom-id="${id}"]`)!.dataset, id)).toBe(true);
    });
  }

  test("resizing the window mid-transition finishes it at once at the new size, with no motion after", async ({ page }) => {
    await open(page, { scenario: "grid" });
    const rec = page.evaluate(() => (window as any).record("grid-1", 1500));
    await page.click('[data-tile="grid-1"]');
    await page.waitForTimeout(150);
    await page.setViewportSize({ width: 600, height: 800 });
    const frames = ((await rec) as any[]).filter((x) => x.card);
    const k = frames.findIndex((x) => x.phase === "open");
    expect(frames[k].t - frames[0].t).toBeLessThan(400); // done right at the resize, not after the spring
    for (let i = k + 1; i < frames.length; i++) {
      expect(Math.abs(frames[i].card.w - frames[i - 1].card.w) + Math.abs(frames[i].card.x - frames[i - 1].card.x)).toBeLessThan(0.5);
    }
    expect(frames.at(-1).card.x + frames.at(-1).card.w).toBeLessThanOrEqual(600);
    // and mid-close: it simply finishes closing
    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);
    await page.setViewportSize({ width: 700, height: 800 });
    await expect.poll(() => clean(page)).toMatchObject({ phase: "idle", clones: 0, hidden: 0, htmlOverflow: "", inert: 0 });
  });

  test("the card hugs the flying image (no card showing beside it) and grows out from it", async ({ page }) => {
    await open(page, { scenario: "grid" });
    const trace = page.evaluate(() => new Promise<any[]>((resolve) => {
      const out: any[] = []; const t0 = performance.now();
      const step = (now: number) => {
        const card = (window as any).card("grid-2") as HTMLElement | null;
        const v = (window as any).cloneVisible(document.querySelector('.zoom-clone[data-zoom-id="grid-2"]'));
        if (card && v && v.w !== undefined && card.style.clipPath) {
          const r = card.getBoundingClientRect(); const k = r.width / card.offsetWidth;
          const ins = card.style.clipPath.match(/inset\(([^r)]*)/)![1].trim().split(/\s+/).map(parseFloat);
          const [t, rr = t, b = t, l = rr] = ins;
          out.push({ left: r.left + l * k, right: r.right - rr * k, top: r.top + t * k, img: v });
        }
        if (now - t0 < 1200) requestAnimationFrame(step); else resolve(out);
      };
      requestAnimationFrame(step);
    }));
    await page.click('[data-tile="grid-2"]');
    const frames = await trace;
    expect(frames.length).toBeGreaterThan(5);
    for (const f of frames) {
      // An edge-to-edge hero: the card's visible sides are the image's sides, all the way.
      expect(Math.abs(f.left - f.img.x)).toBeLessThan(1.5);
      expect(Math.abs(f.right - (f.img.x + f.img.w))).toBeLessThan(1.5);
    }
  });

  test('the close button (default closeButtonTiming "flight") fades in with the flight, above the image, and hands over in place', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await open(page, { scenario: "portfolio" });
    const trace = page.evaluate(() => new Promise<any[]>((resolve) => {
      const out: any[] = []; const t0 = performance.now();
      const step = (now: number) => {
        const c = document.querySelector<HTMLElement>(".zoom-close-copy");
        if (c) { const r = c.getBoundingClientRect(); out.push({ o: +c.style.opacity, x: r.left, y: r.top, w: r.width }); }
        if (now - t0 < 1500) requestAnimationFrame(step); else resolve(out);
      };
      requestAnimationFrame(step);
    }));
    await page.click('[data-tile="portfolio-1"] .pf-thumb');
    const frames = await trace;
    expect(frames.length).toBeGreaterThan(5);
    expect(frames[0].o).toBeLessThan(0.2);
    expect(frames.at(-1).o).toBeGreaterThan(0.95);
    await expect.poll(() => phase(page)).toBe("open");
    expect(await page.locator(".zoom-close-copy").count()).toBe(0); // the real button has taken over
    const real = await page.evaluate(() => { const r = document.querySelector(".zoom-card:not([inert]) .zoom-close")!.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width }; });
    expect(Math.abs(real.x - frames.at(-1).x) + Math.abs(real.y - frames.at(-1).y) + Math.abs(real.w - frames.at(-1).w)).toBeLessThan(1.5);
    expect(await page.evaluate(() => getComputedStyle(document.querySelector(".zoom-card:not([inert]) .zoom-close-bar")!).opacity)).toBe("1");
  });

  test('closeButtonTiming "after": the close button is hidden while the hero flies and shown once it lands', async ({ page }) => {
    await open(page, { scenario: "portfolio", props: { closeButtonTiming: "after" } });
    const rec = page.evaluate(() => (window as any).record("portfolio-1", 1500));
    await page.click('[data-tile="portfolio-1"] .pf-thumb');
    const frames: any[] = await rec;
    expect(frames.filter((x) => x.phase === "opening" && x.closeOpacity !== null).every((x) => x.closeOpacity === "0")).toBe(true);
    expect(frames.at(-1).closeOpacity).toBe("1");
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

test.describe("clicks outside the card", () => {
  test("empty space closes; a neighbour peeking in is switched to", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await open(page, { scenario: "portfolio" });
    await page.click('[data-tile="portfolio-1"] .pf-thumb');
    await expect.poll(() => phase(page)).toBe("open");
    const r1 = await page.evaluate(() => (window as any).R((window as any).card("portfolio-1").getBoundingClientRect()));
    await page.mouse.click(r1.x - 60, 400); // nothing to the left of the first card
    await expect.poll(() => phase(page)).toBe("idle");
    await page.click('[data-tile="portfolio-3"] .pf-thumb');
    await expect.poll(() => phase(page)).toBe("open");
    const r3 = await page.evaluate(() => (window as any).R((window as any).card("portfolio-3").getBoundingClientRect()));
    await page.mouse.click(r3.x + r3.w + 40, 400); // the next project, peeking in
    await expect.poll(() => page.evaluate(() => document.querySelector<HTMLElement>(".zoom-card:not([inert])")?.dataset.zoomId)).toBe("portfolio-4");
    expect(await phase(page)).toBe("open");
    await page.mouse.click(r3.x + 200, r3.y + r3.h + 8); // the strip below the card
    await expect.poll(() => phase(page)).toBe("idle");
  });
});

for (const [label, props] of [["vertical pager", { orientation: "vertical" }], ["stream", { layout: "stream" }], ["horizontal pager", {}]] as const) {
  test(`the narrow gap between two cards does nothing; empty space beside them closes (${label})`, async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await open(page, { scenario: "grid", props });
    await page.click('[data-tile="grid-2"]');
    await expect.poll(() => phase(page)).toBe("open");
    const g = await page.evaluate(() => ({ a: (window as any).R((window as any).card("grid-2").getBoundingClientRect()), b: (window as any).R((window as any).card("grid-3").getBoundingClientRect()) }));
    const vertical = label !== "horizontal pager";
    const gap = vertical ? { x: g.a.x + g.a.w / 2, y: (g.a.y + g.a.h + g.b.y) / 2 } : { x: (g.a.x + g.a.w + g.b.x) / 2, y: g.a.y + g.a.h / 2 };
    await page.mouse.click(gap.x, gap.y);
    await page.waitForTimeout(700);
    expect(await phase(page)).toBe("open");
    // (a stream has no single active card; the pagers must still show the same one)
    if (label !== "stream") expect(await page.evaluate(() => document.querySelector<HTMLElement>(".zoom-card:not([inert])")!.dataset.zoomId)).toBe("grid-2");
    if (vertical) await page.mouse.click(Math.max(5, g.a.x - 40), g.a.y + 100);
    else await page.mouse.click(g.a.x + 100, Math.max(3, g.a.y - 10));
    await expect.poll(() => phase(page)).toBe("idle");
  });
}

test("with only zoom.base.css (no theme), everything still works and nothing is styled", async ({ page }) => {
  await open(page, { scenario: "grid", noTheme: true });
  const f = await flight(page, "grid-2");
  near(f.first, f.before);
  near(f.last, f.hero);
  const look = await page.evaluate(() => {
    const c = (window as any).card("grid-2") as HTMLElement;
    return {
      cardRadius: getComputedStyle(c).borderTopLeftRadius,
      surface: getComputedStyle(c.querySelector(".zoom-card-content")!).backgroundColor,
      dim: getComputedStyle(document.querySelector(".zoom-dim")!).backgroundColor,
      closePosition: getComputedStyle(c.querySelector(".zoom-close")!).position,
    };
  });
  expect(look).toEqual({ cardRadius: "0px", surface: "rgba(0, 0, 0, 0)", dim: "rgba(0, 0, 0, 0)", closePosition: "static" });
  await page.keyboard.press("Escape");
  await expect.poll(() => clean(page)).toMatchObject({ phase: "idle", clones: 0, hidden: 0, htmlOverflow: "", inert: 0 });
});

test("zoom.css is exactly the base and theme files together", async () => {
  const { build } = await import("esbuild");
  const src = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..", "src", "zoom");
  const out = await build({ entryPoints: [join(src, "zoom.css")], bundle: true, write: false, minify: true, logLevel: "silent" });
  const both = await build({ stdin: { contents: '@import "./zoom.base.css"; @import "./zoom.theme.css";', resolveDir: src, loader: "css" }, bundle: true, write: false, minify: true, logLevel: "silent" });
  expect(out.outputFiles[0].text).toBe(both.outputFiles[0].text);
  expect(out.outputFiles[0].text).toContain(":where(.zoom-card)");
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

  test("after a mouse open, Esc returns focus to the thumbnail without a focus ring; after a keyboard open, with one", async ({ page }) => {
    await open(page, { scenario: "portfolio" });
    const ring = () => page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
    await page.click('[data-tile="portfolio-1"] .pf-thumb');
    await expect.poll(() => phase(page)).toBe("open");
    await page.keyboard.press("Escape");
    await expect.poll(() => phase(page)).toBe("idle");
    expect(await page.evaluate(() => (document.activeElement as HTMLElement).dataset.tile)).toBe("portfolio-1");
    expect(await ring()).toBe("none");
    await page.keyboard.press("Tab"); // the next key brings rings back
    expect(await ring()).not.toBe("none");
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Enter");
    await expect.poll(() => phase(page)).toBe("open");
    await page.keyboard.press("Escape");
    await expect.poll(() => phase(page)).toBe("idle");
    expect(await ring()).not.toBe("none");
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
