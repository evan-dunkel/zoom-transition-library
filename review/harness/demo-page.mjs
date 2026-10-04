// Builds review/demo/zoom-demo.html: one self-contained file (no server, no installs).
// Each scenario runs in its own frame, so each is an independent little website.

const SCENARIOS = [
  {
    id: "grid",
    short: "Card grid",
    title: "Card grid zooming into detail pages",
    what: "The main use: a grid of cards. Clicking one zooms its picture up into a full detail page. The neighbouring stories peek in at the sides, and you can move between them.",
    good: [
      "The picture should leave from exactly where the card is and land exactly at the top of the detail page. I measured it to the pixel: it does.",
      "Close with Esc, the ✕ button, a click on the dark area above the card, or by dragging the card down from its top edge with the mouse. It should shrink back into its own card, and the other cards should fly home too.",
      "← and → move between stories. At either end there is a small bounce.",
      "Resize the browser window while a card is open. The card should re-fit to the new size.",
    ],
    bad: [
      "Turn on Slow motion and watch the very first moment of the zoom. The thumbnail’s rounded corners turn square in one frame, and the picture inside shifts. The flying picture is the detail page’s wider image, cropped differently from the thumbnail.",
      "The ✕ button pops in only at the very end, because the flying picture covers it until it lands.",
      "Resize the window <em>while a card is still zooming open</em>. The card stays at the old size, partly off-screen, until you resize again.",
      "Try to select text in an open story. You can’t: all text in the open view is unselectable.",
    ],
  },
  {
    id: "scrolled",
    short: "Scrolled page",
    title: "A scrolled page with a sticky header",
    what: "A long page with a header that stays stuck to the top. The cards are further down, so you have to scroll before opening one.",
    good: [
      "Scroll down to “Featured walks” and open a card. It should still leave from exactly the right place. I measured it: it does.",
      "While a card is open, the page behind can’t scroll (on purpose). After closing, you should be at the same scroll position as before.",
    ],
    bad: [
      "Scroll so a card is half hidden under the sticky header, then open it. The hidden half jumps out on top of the header in one frame. On close, the picture lands on top of the header, then snaps underneath it.",
    ],
  },
  {
    id: "mobile",
    short: "Phone width",
    title: "Narrow, phone-width layout (390 px)",
    phone: true,
    what: "A phone-width list. Small square thumbnails zoom up into full-screen pages, which is a big change of shape.",
    good: [
      "The zoom should start from the small square and end exactly at the top of the page.",
      "With a mouse, drag the open card down from its top edge to close it, or drag sideways to move between stories. For real touch gestures, press “Open in full window” and turn on your browser’s device mode. In Chrome that’s DevTools → the phone icon, or Ctrl/Cmd+Shift+M.",
    ],
    bad: [
      "The rounded-corner pop and the picture shift at take-off are easier to see here, because the shape changes so much (square to wide).",
    ],
  },
  {
    id: "reduced",
    short: "Reduced motion",
    title: "Reduced motion turned on (simulated)",
    simulateReduced: true,
    what: "This frame pretends your device has <em>Reduce motion</em> turned on, so you can see the result without changing any settings.",
    good: [
      "Opening and closing should be a plain cross-fade. Nothing should move, grow or shrink. I measured it: nothing moves.",
      "← and → should switch stories instantly, without sliding.",
    ],
    bad: [
      "If you change the real setting on your device while this page is open, the library ignores the change until you reload the page.",
    ],
    reducedHelp: true,
  },
  {
    id: "rapid",
    short: "Rapid clicks",
    title: "Rapid repeated clicks and interruptions",
    what: "The buttons in the frame run quick sequences (double-click, eight fast clicks, Esc or Back halfway through, and so on). Try them yourself as well. Browser history is turned on in this scenario, so the browser’s Back button closes the card.",
    good: [
      "After every test, the dark status bar at the bottom should read <b>clean ✓</b> once things settle. If a card is still open, press Esc first. I ran all of these tests automatically, and every one ended clean.",
      "Click a card as it shrinks back home: it should turn around and open again smoothly, without restarting.",
      "Press “Open in full window” to see the address bar. Opening a card adds <code>#rapid-2</code> (for example) to the address, and the browser’s Back button closes it.",
    ],
    bad: [
      "In the full-window version, reload while a card is open, or copy the address into a new tab. The card does <em>not</em> reopen, and the address keeps a stale <code>#…</code>. Deep links only work if your site has real pages at those addresses.",
    ],
  },
  {
    id: "late",
    short: "Late photos",
    title: "Photos that load late (critical bug)",
    what: "The detail pages use real photos that take about a second to “download” the first time. Odd-numbered cards (1, 3, 5) don’t reserve space for the photo. Even-numbered cards (2, 4, 6) do, using CSS <code>aspect-ratio</code>. That’s how most real sites behave on a first visit.",
    good: ["Cards 2, 4 and 6 (“Photo space reserved”) zoom normally. The photo fades into place once it arrives."],
    bad: [
      "Open card 1, 3 or 5. The zoom gets <b>stuck</b>. The photo area stays blank, a stray copy of the image stays on screen, and the status bar never returns to idle. Press Esc: the page stays frozen, can’t scroll, and the card stays missing. Only a reload fixes it. Press <b>Reload stage</b> to recover.",
    ],
  },
  {
    id: "carousel",
    short: "Off-screen source",
    title: "A source that is partly off-screen (sideways row)",
    what: "A sideways-scrolling row of cards, where the last visible card is cut off by the edge of the row.",
    good: ["Open the cut-off card. It should zoom from where it actually is, half-hidden."],
    bad: [
      "Open a card, press → a few times to reach a story whose card is off-screen in the row, then close. The row jumps instantly to show that card before the zoom flies home, instead of scrolling smoothly.",
    ],
  },
  {
    id: "keyboard",
    short: "Keyboard",
    title: "Keyboard and screen reader",
    what: "Detail pages with a text field and a link, to test keyboard use. Click inside the frame first, then use only the keyboard.",
    good: [
      "Tab to a card and press Enter. Focus (the outline) should move to the ✕ button. Press Esc: the card closes and focus returns to the card you opened.",
    ],
    bad: [
      "With a card open, press Tab three times. Focus leaves the card and goes to the hidden page behind it (the header links). A keyboard user is now lost.",
      "Click in the note field and press ← or →. Instead of moving the text cursor, it switches to another story. Esc inside the field closes the whole card.",
      "Screen readers aren’t told that anything opened, and the open view has no name. On a Mac, turn on VoiceOver with Cmd+F5. On Windows, turn on Narrator with Ctrl+Win+Enter.",
    ],
  },
];

const REDUCED_STUB = `(() => {
  const real = window.matchMedia.bind(window);
  window.matchMedia = (q) => /prefers-reduced-motion/.test(q)
    ? { matches: !/no-preference/.test(q), media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } }
    : real(q);
})();`;

export function makeDemo(js) {
  const b64 = Buffer.from(js, "utf8").toString("base64");
  const scenarioHtml = SCENARIOS.map(
    (s, i) => `
<section class="scenario" id="s-${s.id}" aria-labelledby="h-${s.id}">
  <div class="scenario-text">
    <p class="eyebrow">Scenario ${i + 1}</p>
    <h2 id="h-${s.id}">${s.title}</h2>
    <p class="what">${s.what}</p>
    <h3>What to look for</h3>
    <ul class="checks">
      ${s.good.map((g) => `<li class="good"><span class="tag tag-good">Should</span><span>${g}</span></li>`).join("")}
      ${s.bad.map((g) => `<li class="bad"><span class="tag tag-bad">Problem</span><span>${g}</span></li>`).join("")}
    </ul>
    ${s.reducedHelp ? REDUCED_HELP : ""}
  </div>
  <div class="stage-wrap${s.phone ? " phone" : ""}">
    <div class="stage-bar">
      <span class="stage-name">${s.phone ? "390 × 760 phone" : "Stage"}</span>
      <button type="button" data-reload="${s.id}">Reload stage</button>
      <button type="button" data-window="${s.id}">Open in full window</button>
    </div>
    <iframe class="stage" title="Scenario ${i + 1}: ${s.title.replace(/"/g, "")}" data-scenario="${s.id}"${s.simulateReduced ? " data-reduced" : ""} loading="lazy"></iframe>
  </div>
</section>`,
  ).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Zoom Transition Demo</title>
<style>
:root {
  --bg: #f4f2ee; --panel: #ffffff; --ink: #1d1e22; --muted: #5d6068; --line: #dedad2;
  --good: #1f7a4d; --good-bg: #e3f4ea; --bad: #a33a1c; --bad-bg: #fbe7df; --accent: #2f5d50;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --bg: #16171a; --panel: #1f2125; --ink: #ececee; --muted: #a3a6ad; --line: #34363c; --good: #7fd6a6; --good-bg: #1b3326; --bad: #ffa48a; --bad-bg: #3b2119; --accent: #8cc7b4; color-scheme: dark; }
}
:root[data-theme="dark"] { --bg: #16171a; --panel: #1f2125; --ink: #ececee; --muted: #a3a6ad; --line: #34363c; --good: #7fd6a6; --good-bg: #1b3326; --bad: #ffa48a; --bad-bg: #3b2119; --accent: #8cc7b4; color-scheme: dark; }
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--bg); color: var(--ink); }
body { font: 16px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
a { color: var(--accent); }
code { font: 0.88em ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--line); padding: 1px 5px; border-radius: 4px; }
.top { position: sticky; top: 0; z-index: 5; background: color-mix(in srgb, var(--bg) 92%, transparent); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); }
.top-inner { max-width: 1240px; margin: 0 auto; padding: 10px 16px; display: flex; flex-wrap: wrap; gap: 10px 18px; align-items: center; }
.top strong { font-size: 0.95rem; }
.top nav { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 0.85rem; }
.top nav a { color: var(--muted); text-decoration: none; }
.top nav a:hover { color: var(--ink); }
.speed { margin-left: auto; display: inline-flex; border: 1px solid var(--line); border-radius: 999px; overflow: hidden; }
.speed button { font: 600 13px/1 system-ui, sans-serif; padding: 8px 12px; border: 0; background: transparent; color: var(--muted); cursor: pointer; }
.speed button[aria-pressed="true"] { background: var(--ink); color: var(--bg); }
main { max-width: 1240px; margin: 0 auto; padding: 24px 16px 80px; }
.intro { max-width: 760px; }
.intro h1 { font-size: 2rem; line-height: 1.15; margin: 8px 0 12px; letter-spacing: -0.01em; }
.intro p { color: var(--muted); margin: 0 0 12px; }
.legend { display: flex; flex-wrap: wrap; gap: 8px 16px; font-size: 0.9rem; color: var(--muted); margin: 14px 0 0; }
.scenario { scroll-margin-top: 64px; display: grid; grid-template-columns: minmax(0, 360px) minmax(0, 1fr); gap: 28px; padding: 40px 0; border-top: 1px solid var(--line); }
.scenario:first-of-type { margin-top: 28px; }
@media (max-width: 900px) { .scenario { grid-template-columns: minmax(0, 1fr); } }
.eyebrow { margin: 0; font: 700 12px/1.2 system-ui, sans-serif; letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent); }
.scenario h2 { margin: 6px 0 10px; font-size: 1.45rem; line-height: 1.2; }
.scenario h3 { margin: 18px 0 8px; font-size: 0.95rem; }
.what { margin: 0; color: var(--muted); }
.checks { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; font-size: 0.93rem; }
.checks li { display: grid; grid-template-columns: auto 1fr; gap: 10px; align-items: start; }
.tag { font: 700 11px/1 system-ui, sans-serif; letter-spacing: 0.04em; text-transform: uppercase; padding: 5px 7px; border-radius: 6px; margin-top: 2px; white-space: nowrap; }
.tag-good { color: var(--good); background: var(--good-bg); }
.tag-bad { color: var(--bad); background: var(--bad-bg); }
.stage-wrap { min-width: 0; }
.stage-bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 8px; }
.stage-name { font-size: 0.8rem; color: var(--muted); margin-right: auto; }
.stage-bar button { font: 600 13px/1 system-ui, sans-serif; padding: 8px 12px; border-radius: 999px; border: 1px solid var(--line); background: var(--panel); color: var(--ink); cursor: pointer; }
.stage-bar button:hover { border-color: var(--accent); }
.stage { display: block; width: 100%; height: 640px; border: 1px solid var(--line); border-radius: 14px; background: #f6f3ee; }
.phone .stage { width: 390px; max-width: 100%; height: 760px; border: 10px solid #222; border-radius: 40px; margin: 0 auto; }
.phone .stage-bar { max-width: 390px; margin-left: auto; margin-right: auto; }
.howto { margin-top: 18px; padding: 14px 16px; border-radius: 12px; background: var(--panel); border: 1px solid var(--line); font-size: 0.9rem; }
.howto h3 { margin-top: 0; }
.howto dl { margin: 0; display: grid; gap: 8px; }
.howto dt { font-weight: 700; }
.howto dd { margin: 0; color: var(--muted); }
footer { max-width: 1240px; margin: 0 auto; padding: 0 16px 40px; color: var(--muted); font-size: 0.85rem; }
</style>
</head>
<body>
<div class="top"><div class="top-inner">
  <strong>Zoom transition review demo</strong>
  <nav aria-label="Scenarios">${SCENARIOS.map((s, i) => `<a href="#s-${s.id}">${i + 1}. ${s.short}</a>`).join("")}</nav>
  <div class="speed" role="group" aria-label="Animation speed">
    <button type="button" data-speed="1" aria-pressed="true">Normal speed</button>
    <button type="button" data-speed="0.25" aria-pressed="false">Slow motion (¼)</button>
    <button type="button" data-speed="0.08" aria-pressed="false">Super slow</button>
  </div>
</div></div>
<main>
  <div class="intro">
    <h1>See the zoom transitions for yourself</h1>
    <p>Each framed area below (a “stage”) is a small, separate website built with the library, completely unmodified. Click the cards inside a stage to try it. Everything runs from this one file: no internet connection, installs or server needed.</p>
    <p>Use <b>Slow motion</b> (top right) to judge the motion frame by frame. A dark status bar at the bottom of each stage shows what the library is doing. When nothing is happening, it should read <b>clean ✓</b>, meaning nothing was left behind on the page.</p>
    <div class="legend"><span><span class="tag tag-good">Should</span> what correct behaviour looks like</span><span><span class="tag tag-bad">Problem</span> an issue I confirmed, explained in the report</span></div>
  </div>
  ${scenarioHtml}
</main>
<footer>Built for the code review. Library source: <code>src/zoom/</code> (unchanged). Demo source: <code>review/harness/app/</code>.</footer>
<script>
const BUNDLE = new TextDecoder().decode(Uint8Array.from(atob(${JSON.stringify(b64)}), (c) => c.charCodeAt(0)));
const REDUCED_STUB = ${JSON.stringify(REDUCED_STUB)};
let speed = 1;
const stageHtml = (scenario, reduced) =>
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Scenario: ' + scenario + '</title></head><body><div id="app"></div><script>window.ZOOM_DEMO=' +
  JSON.stringify({ scenario, timeScale: speed, simulatedReduced: reduced }) + ';' + (reduced ? REDUCED_STUB : '') + '<\\/script><script>' + BUNDLE + '<\\/script></body></html>';
const frames = [...document.querySelectorAll("iframe.stage")];
// Stages load from blob: URLs rather than srcdoc, so the browser history (Back button) works inside them.
const blobUrl = (f) => URL.createObjectURL(new Blob([stageHtml(f.dataset.scenario, f.hasAttribute("data-reduced"))], { type: "text/html" }));
const load = (f) => { if (f.dataset.url) URL.revokeObjectURL(f.dataset.url); f.dataset.url = blobUrl(f); f.src = f.dataset.url; f.dataset.loaded = "1"; };
const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting && !e.target.dataset.loaded) load(e.target); }), { rootMargin: "400px" });
frames.forEach((f) => io.observe(f));
document.addEventListener("click", (e) => {
  const t = e.target.closest("button"); if (!t) return;
  if (t.dataset.reload) load(document.querySelector('iframe[data-scenario="' + t.dataset.reload + '"]'));
  if (t.dataset.window) {
    const f = document.querySelector('iframe[data-scenario="' + t.dataset.window + '"]');
    window.open(blobUrl(f), "_blank");
  }
  if (t.dataset.speed) {
    speed = Number(t.dataset.speed);
    document.querySelectorAll("[data-speed]").forEach((b) => b.setAttribute("aria-pressed", String(b === t)));
    frames.forEach((f) => f.contentWindow && f.contentWindow.postMessage({ type: "zoom-demo-timescale", value: speed }, "*"));
  }
});
</script>
</body>
</html>`;
}

const REDUCED_HELP = `
<div class="howto">
  <h3>How to turn on reduced motion for real</h3>
  <dl>
    <dt>macOS</dt><dd>System Settings → Accessibility → Display → Reduce motion.</dd>
    <dt>Windows 11</dt><dd>Settings → Accessibility → Visual effects → Animation effects: Off.</dd>
    <dt>iPhone / iPad</dt><dd>Settings → Accessibility → Motion → Reduce Motion.</dd>
    <dt>Android</dt><dd>Settings → Accessibility → Remove animations (the wording varies by phone).</dd>
    <dt>Chrome only (no system change)</dt><dd>DevTools (F12) → ⋮ menu → More tools → Rendering → “Emulate CSS media feature prefers-reduced-motion” → reduce.</dd>
  </dl>
  <p>Then <b>reload this page</b>. The status bar in every stage should read “reduced motion: ON (your OS)”, and every scenario should cross-fade instead of zooming.</p>
</div>`;
