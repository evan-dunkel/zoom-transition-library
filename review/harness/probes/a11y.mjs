import { launch, openScenario } from "./lib.mjs";
const browser = await launch();
const page = await openScenario(browser, { scenario: "keyboard" });
const where = () => page.evaluate(() => {
  const a = document.activeElement;
  const inOverlay = !!a?.closest(".zoom-root");
  return `${inOverlay ? "OVERLAY" : "PAGE   "} <${a?.tagName.toLowerCase()} ${a?.className || ""}> ${(a?.getAttribute("aria-label") || a?.textContent || "").trim().slice(0, 40)}`;
});
await page.focus('[data-tile="keyboard-2"]');
await page.keyboard.press("Enter");
await page.waitForTimeout(1200);
console.log("after Enter-open, focus:", await where());
const ax = await page.evaluate(() => {
  const root = document.querySelector(".zoom-root");
  const live = document.querySelector(".zoom-sr");
  return { role: root.getAttribute("role"), ariaModal: root.getAttribute("aria-modal"), name: root.getAttribute("aria-label") || root.getAttribute("aria-labelledby"), liveRegionText: live.textContent, cardLabel: document.querySelector('.zoom-card[data-zoom-id="keyboard-2"]').getAttribute("aria-label"), urlChanged: location.hash };
});
console.log("dialog semantics:", JSON.stringify(ax));
const snap = await page.locator(".zoom-root").ariaSnapshot().catch((e) => "ariaSnapshot failed " + e.message);
console.log("aria snapshot (first lines):\n" + snap.split("\n").slice(0, 8).join("\n"));
for (let i = 1; i <= 7; i++) { await page.keyboard.press("Tab"); console.log(` Tab ${i}:`, await where()); }
// arrow keys inside the text field
await page.focus('.zoom-card[data-zoom-id="keyboard-2"] input');
const before = await page.evaluate(() => ({ caret: document.activeElement.selectionStart, active: document.querySelector('.zoom-card:not([inert])')?.dataset.zoomId }));
await page.keyboard.press("End");
await page.keyboard.press("ArrowLeft");
await page.waitForTimeout(900);
const after = await page.evaluate(() => ({ caret: document.activeElement?.selectionStart, focus: document.activeElement?.tagName, active: document.querySelector('.zoom-card:not([inert])')?.dataset.zoomId }));
console.log("ArrowLeft in text field: before", JSON.stringify(before), "after", JSON.stringify(after));
await page.focus('.zoom-card[data-zoom-id="keyboard-1"] input').catch(() => {});
await page.evaluate(() => document.querySelector('.zoom-card:not([inert]) input')?.focus());
await page.keyboard.press("Escape");
await page.waitForTimeout(900);
console.log("Escape inside text field ->", await page.evaluate(() => phase()), "| focus now:", await where());
// text selection inside detail
await page.click('[data-tile="keyboard-3"]'); await page.waitForTimeout(1200);
console.log("user-select on detail text:", await page.evaluate(() => getComputedStyle(document.querySelector('.zoom-card:not([inert]) .detail-body p')).userSelect));
// is the page behind hidden from assistive tech / inert?
console.log("page behind inert/aria-hidden?", await page.evaluate(() => ({ mainInert: document.querySelector("main").closest("[inert]") !== null, ariaHidden: document.querySelector("main").closest("[aria-hidden=true]") !== null })));
await browser.close();
