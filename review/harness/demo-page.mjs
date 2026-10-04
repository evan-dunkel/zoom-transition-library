// Builds review/demo/zoom-demo.html: one self-contained file (no server, no installs).
// Each scenario runs in its own frame, so each is an independent little website. Both
// versions of the library are inside: the fixed one (src/zoom) and the original as
// received, switchable from the top bar.

// Note kinds: should = correct behaviour to confirm; fixed = was a bug, now fixed (switch
// to Original to see the old behaviour); problem = still an issue; note = a design choice.
const SCENARIOS = [
  {
    id: "portfolio",
    short: "Your layout",
    title: "Your portfolio layout",
    what: "Modelled on your index: two columns of 3:2 images with rounded corners and title-plus-sentence captions. Each image zooms into a card where it sits <em>inset</em>, with a margin around it, not edge to edge. Your photos are swapped for drawn placeholders.",
    notes: [
      { k: "should", s: "Image leaves exactly from the thumbnail and lands exactly in the card", t: "The image should leave from exactly where the thumbnail is and land exactly in its spot inside the card. The white card grows around it from the thumbnail outward. I measured it at 0 px difference on desktop and phone widths." },
      { k: "fixed", s: "Rounded corners stay rounded through the whole zoom", t: "The image keeps its 14 px rounded corners for the whole flight, both opening and closing. In the original version, the corners turned square in a single frame when the zoom started." },
      { k: "should", s: "Close returns the image to its own thumbnail", t: "Close with Esc, the ✕ button, a click on the dark area, or by scrolling up past the top of the card. The image should shrink back into its own thumbnail." },
      { k: "fixed", s: "Empty space closes; the narrow gap between projects does nothing", t: "Click anywhere outside the cards, including the empty side next to the first or last project: the card closes. Clicking the narrow gap between two projects does nothing, so a near miss doesn’t close it. Click a neighbouring project that peeks in at the side: it slides over to that project." },
      { k: "fixed", s: "Esc after a mouse open leaves no focus ring", t: "Open with the mouse, close with Esc: focus goes back to the thumbnail without a focus ring, and the ring appears once you press Tab. Open with the keyboard (Tab, then Enter) and close with Esc: the ring shows, as it should." },
      { k: "note", s: "Neighbouring projects peek in at the sides (paging)", t: "The neighbouring projects peek in at the sides, and ← → moves between them. That is the library’s default “group” behaviour; one setting (<code>paging={false}</code>) shows only the opened project instead." },
      { k: "fixed", s: "The ✕ button: after landing, or with the flight (switch at the top)", t: "With “✕ after landing” (the default), the button stays hidden while the image flies, then fades in quickly (100 ms) once it lands. With “✕ with flight”, it fades in and out with the flight itself, drawn above the flying image, and hands over to the real button in place. The setting is <code>closeButtonTiming</code>." },
    ],
  },
  {
    id: "grid",
    short: "Card grid",
    title: "Card grid, image edge to edge",
    what: "A different layout: the detail page’s picture runs edge to edge across the top of the card, and the thumbnails are a different shape (4:3) from the detail picture (16:10).",
    notes: [
      { k: "should", s: "Picture leaves from and lands on exactly the right place", t: "The picture should leave from exactly where the card is and land exactly at the top of the detail page." },
      { k: "fixed", s: "Each corner blends smoothly, open and close (no pop)", t: "Use Slow motion. Each corner blends from the thumbnail’s 14 px to where it ends up: the two top corners to the card’s rounded 28 px, the two bottom corners to square. Closing does the reverse." },
      { k: "fixed", s: "The image's shape changes smoothly, and the card grows out from it", t: "The thumbnail (4:3) and the detail picture (16:10) are cropped differently. The flying image changes smoothly from one shape to the other, and the card now hugs it all the way, growing out from the image instead of showing white bands beside it (the jump you saw). No dissolve, no double image." },
      { k: "fixed", s: "Resizing mid-zoom finishes the zoom at once, at the new size", t: "Resize the window <em>while</em> a card is zooming open or closed. The zoom finishes immediately at the new size, open or closed, instead of the layout lurching while it catches up." },
      { k: "fixed", s: "Text in an open card can be selected; a mouse drag no longer moves the card", t: "Click and drag across the text of an open story: it should select, ready to copy. A mouse no longer drags the card around. Touch screens still can, to close or to move between stories." },
    ],
  },
  {
    id: "scrolled",
    short: "Scrolled page",
    title: "A scrolled page with a sticky header",
    what: "A long page with a header that stays stuck to the top. The cards are further down, so you have to scroll before opening one.",
    notes: [
      { k: "should", s: "Zoom starts from the right place after scrolling", t: "Scroll down to “Featured walks” and open a card. It should still start exactly from the card." },
      { k: "should", s: "Same scroll position after closing", t: "While a card is open the page behind can’t scroll. After closing, you should be at the same scroll position as before." },
      { k: "problem", s: "A card half under the sticky header pops out over it", t: "Scroll so a card is half hidden under the header, then open it. The hidden half jumps out on top of the header in one frame, and on close it lands on top of the header, then snaps underneath. Not fixed; your index has no sticky header." },
    ],
  },
  {
    id: "mobile",
    short: "Phone width",
    title: "Narrow, phone-width layout (390 px)",
    phone: true,
    what: "A phone-width list. Small square thumbnails zoom up into full-screen pages, which is a big change of shape.",
    notes: [
      { k: "should", s: "Zoom starts from the small square and ends at the top of the page", t: "The zoom should start from the small square and end exactly at the top of the page." },
      { k: "should", s: "Touch: drag down from the top to close, sideways to page", t: "To try touch gestures, press “Open in full window” and turn on device mode (Chrome DevTools → the phone icon, or Ctrl/Cmd+Shift+M). Then drag the card down from its top edge to close it, or sideways to move between stories." },
      { k: "fixed", s: "A mouse no longer drags the card (it selects text instead)", t: "With a plain mouse, dragging now selects text instead of moving the card. Close with Esc, ✕, a click outside the card, or by scrolling up past the top." },
    ],
  },
  {
    id: "reduced",
    short: "Reduced motion",
    title: "Reduced motion turned on (simulated)",
    simulateReduced: true,
    what: "This frame pretends your device has <em>Reduce motion</em> turned on, so you can see the result without changing any settings.",
    notes: [
      { k: "fixed", s: "Opening and closing are instant: no movement, no fade", t: "Opening and closing should be instant. The detail page is simply there, then simply gone: nothing moves, grows, shrinks or fades. In the original version, it was a cross-fade." },
      { k: "should", s: "← → switch stories instantly", t: "← and → should switch stories instantly, without sliding." },
      { k: "fixed", s: "Changing the device setting works without reloading", t: "If you change the real setting on your device while this page is open, the stages in the other scenarios follow the change without a reload. In the original version, it took a reload." },
    ],
    reducedHelp: true,
  },
  {
    id: "rapid",
    short: "Rapid clicks",
    title: "Rapid repeated clicks and interruptions",
    what: "The buttons in the frame run quick sequences: double-click, eight fast clicks, Esc or Back halfway through, and so on. Try them by hand as well. Browser history is turned on in this scenario, so the browser’s Back button closes the card.",
    notes: [
      { k: "should", s: "Status bar reads clean ✓ after every test", t: "After every test, the dark status bar at the bottom should read <b>clean ✓</b> once things settle. If a card is still open, press Esc first." },
      { k: "should", s: "Tapping a card as it shrinks home turns it around smoothly", t: "Click a card as it shrinks back home: it should turn around and open again smoothly, without restarting." },
      { k: "fixed", s: "Closing onto a different crop no longer jumps", t: "These thumbnails are cropped differently from their detail pictures. Closing should change the crop smoothly back to the thumbnail’s, with no jump and no dissolve." },
      { k: "note", s: "A reloaded #id address doesn't reopen the card", t: "In “Open in full window”, reloading while a card is open shows the grid, with nothing open. On your real site this is solved by giving every project its own page (for example <code>/work/slug</code>); see the report’s framework section." },
    ],
  },
  {
    id: "late",
    short: "Late photos",
    title: "Photos that load late",
    what: "The detail pages use photos that take about a second to “download” the first time. Odd-numbered cards (1, 3, 5) don’t reserve space for the photo. Even-numbered cards (2, 4, 6) do, using CSS <code>aspect-ratio</code>.",
    notes: [
      { k: "fixed", s: "Cards 1, 3, 5 no longer freeze the page", t: "Open card 1, 3 or 5. The card should zoom open normally, and the photo appears inside it when it arrives. In the original version, this froze the page until a reload; press <b>Reload stage</b> if you try it there." },
      { k: "problem", s: "Without reserved space, text jumps down when the photo arrives", t: "On cards 1, 3 and 5, the text jumps down when the photo arrives. That’s the page, not the library: always reserve image space (on your site, the framework’s image component does this for you)." },
      { k: "should", s: "Cards 2, 4, 6 behave normally", t: "Cards 2, 4 and 6 (“Photo space reserved”) zoom normally, and the photo fills in its reserved space when it arrives." },
    ],
  },
  {
    id: "carousel",
    short: "Off-screen source",
    title: "A source that is partly off-screen (sideways row)",
    what: "A sideways-scrolling row of cards, where the last visible card is cut off by the edge of the row.",
    notes: [
      { k: "should", s: "A cut-off card zooms from where it actually is", t: "Open the cut-off card. It should zoom from where it actually is, half-hidden." },
      { k: "problem", s: "Row jumps instantly when closing onto an off-screen card", t: "Open a card, press → a few times to reach a story whose card is off-screen in the row, then close. The row jumps instantly to show that card before the zoom flies home. Not fixed: it’s a minor trade-off." },
    ],
  },
  {
    id: "keyboard",
    short: "Keyboard",
    title: "Keyboard and screen reader",
    what: "Detail pages with a text field and a link. Click inside the frame first, then use only the keyboard.",
    notes: [
      { k: "should", s: "Enter opens with focus on ✕; Esc closes and focus returns", t: "Tab to a card and press Enter. Focus (the outline) should move to the ✕ button. Press Esc: the card closes and focus returns to the card you opened." },
      { k: "fixed", s: "Tab stays inside the open card", t: "With a card open, press Tab repeatedly. Focus should cycle through the card’s ✕ button, the text field and the link. Past the end, focus may briefly go to the browser’s own toolbar, as it does with any dialog, then return to the card. It should never land on the page behind. In the original version, it did." },
      { k: "fixed", s: "← → inside the text field move the cursor", t: "Click in the note field and press ← or →. The text cursor should move, and the card should stay put. In the original version, the keys switched stories." },
      { k: "fixed", s: "Screen readers hear the project's name when it opens", t: "With a screen reader on, opening a card should announce a dialog named after the story. On a Mac, turn on VoiceOver with Cmd+F5. On Windows, turn on Narrator with Ctrl+Win+Enter. In the original version, the dialog had no name." },
      { k: "note", s: "Esc inside the text field closes the card", t: "Esc inside the text field closes the card, the same way native browser dialogs behave. I kept it that way." },
    ],
  },
];

const KIND = {
  should: { label: "Should", cls: "tag-good" },
  fixed: { label: "Fixed", cls: "tag-fixed" },
  problem: { label: "Problem", cls: "tag-bad" },
  note: { label: "Note", cls: "tag-note" },
};

const REDUCED_STUB = `(() => {
  const real = window.matchMedia.bind(window);
  window.matchMedia = (q) => /prefers-reduced-motion/.test(q)
    ? { matches: !/no-preference/.test(q), media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } }
    : real(q);
})();`;

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
  <p>The status bar in every stage then reads “reduced motion: ON (your OS)”. With the Fixed library, the stages follow the change straight away; with the Original, reload the page.</p>
</div>`;

const b64 = (s) => Buffer.from(s, "utf8").toString("base64");

export function makeDemo(js, jsOriginal) {
  const scenarioHtml = SCENARIOS.map(
    (s, i) => `
<section class="scenario" id="s-${s.id}" aria-labelledby="h-${s.id}" data-n="${i + 1}" data-title="${s.title.replace(/"/g, "&quot;")}">
  <div class="scenario-text">
    <p class="eyebrow">Scenario ${i + 1}</p>
    <h2 id="h-${s.id}">${s.title}</h2>
    <p class="what">${s.what}</p>
    <h3>What to look for <span class="hint">· tick what you see</span></h3>
    <ul class="checks">
      ${s.notes
        .map(
          (n, j) => `<li><label class="check"><input type="checkbox" data-note="${i + 1}.${j + 1}" data-kind="${n.k}" data-short="${n.s.replace(/"/g, "&quot;")}"><span class="tag ${KIND[n.k].cls}">${KIND[n.k].label}</span><span class="note-text">${n.t}</span></label></li>`,
        )
        .join("")}
    </ul>
    <label class="free">Anything else you noticed<textarea rows="2" data-free="${i + 1}"></textarea></label>
    ${s.reducedHelp ? REDUCED_HELP : ""}
  </div>
  <div class="stage-wrap${s.phone ? " phone" : ""}">
    <div class="stage-bar">
      <span class="stage-name">${s.phone ? "390 × 760 phone" : "Stage"} · <span class="lib-name">Fixed library</span></span>
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
  --good: #1f7a4d; --good-bg: #e3f4ea; --bad: #a33a1c; --bad-bg: #fbe7df; --fixed: #1f4fa3; --fixed-bg: #e3ebfa; --note-bg: #ebe9e4;
  --accent: #2f5d50;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --bg: #16171a; --panel: #1f2125; --ink: #ececee; --muted: #a3a6ad; --line: #34363c; --good: #7fd6a6; --good-bg: #1b3326; --bad: #ffa48a; --bad-bg: #3b2119; --fixed: #9dbcff; --fixed-bg: #1c2740; --note-bg: #2a2c31; --accent: #8cc7b4; color-scheme: dark; }
}
:root[data-theme="dark"] { --bg: #16171a; --panel: #1f2125; --ink: #ececee; --muted: #a3a6ad; --line: #34363c; --good: #7fd6a6; --good-bg: #1b3326; --bad: #ffa48a; --bad-bg: #3b2119; --fixed: #9dbcff; --fixed-bg: #1c2740; --note-bg: #2a2c31; --accent: #8cc7b4; color-scheme: dark; }
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
.controls { margin-left: auto; display: flex; flex-wrap: wrap; gap: 8px; }
.seg { display: inline-flex; border: 1px solid var(--line); border-radius: 999px; overflow: hidden; }
.seg button { font: 600 13px/1 system-ui, sans-serif; padding: 8px 12px; border: 0; background: transparent; color: var(--muted); cursor: pointer; }
.seg button[aria-pressed="true"] { background: var(--ink); color: var(--bg); }
main { max-width: 1240px; margin: 0 auto; padding: 24px 16px 80px; }
.intro { max-width: 780px; }
.intro h1 { font-size: 2rem; line-height: 1.15; margin: 8px 0 12px; letter-spacing: -0.01em; }
.intro p { color: var(--muted); margin: 0 0 12px; }
.legend { display: flex; flex-wrap: wrap; gap: 8px 16px; font-size: 0.9rem; color: var(--muted); margin: 14px 0 0; }
.scenario { scroll-margin-top: 64px; display: grid; grid-template-columns: minmax(0, 380px) minmax(0, 1fr); gap: 28px; padding: 40px 0; border-top: 1px solid var(--line); }
.scenario:first-of-type { margin-top: 28px; }
@media (max-width: 900px) { .scenario { grid-template-columns: minmax(0, 1fr); } }
.eyebrow { margin: 0; font: 700 12px/1.2 system-ui, sans-serif; letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent); }
.scenario h2 { margin: 6px 0 10px; font-size: 1.45rem; line-height: 1.2; }
.scenario h3 { margin: 18px 0 8px; font-size: 0.95rem; }
.hint { font-weight: 400; color: var(--muted); }
.what { margin: 0; color: var(--muted); }
.checks { list-style: none; padding: 0; margin: 0; display: grid; gap: 6px; font-size: 0.93rem; }
.check { display: grid; grid-template-columns: auto auto 1fr; gap: 10px; align-items: start; padding: 8px; margin: 0 -8px; border-radius: 10px; cursor: pointer; }
.check:hover { background: var(--panel); }
.check input { width: 18px; height: 18px; margin: 2px 0 0; accent-color: var(--accent); }
.check:has(input:checked) { background: var(--panel); box-shadow: inset 0 0 0 1px var(--line); }
.tag { font: 700 11px/1 system-ui, sans-serif; letter-spacing: 0.04em; text-transform: uppercase; padding: 5px 7px; border-radius: 6px; margin-top: 2px; white-space: nowrap; }
.tag-good { color: var(--good); background: var(--good-bg); }
.tag-bad { color: var(--bad); background: var(--bad-bg); }
.tag-fixed { color: var(--fixed); background: var(--fixed-bg); }
.tag-note { color: var(--muted); background: var(--note-bg); }
.free { display: grid; gap: 6px; margin-top: 14px; font-size: 0.85rem; color: var(--muted); }
.free textarea, .results textarea { font: inherit; font-size: 0.9rem; color: var(--ink); background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; resize: vertical; }
.stage-wrap { min-width: 0; }
.stage-bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 8px; }
.stage-name { font-size: 0.8rem; color: var(--muted); margin-right: auto; }
.stage-bar button, .results button { font: 600 13px/1 system-ui, sans-serif; padding: 8px 12px; border-radius: 999px; border: 1px solid var(--line); background: var(--panel); color: var(--ink); cursor: pointer; }
.stage-bar button:hover, .results button:hover { border-color: var(--accent); }
.stage { display: block; width: 100%; height: 680px; border: 1px solid var(--line); border-radius: 14px; background: #f6f3ee; }
.phone .stage { width: 390px; max-width: 100%; height: 760px; border: 10px solid #222; border-radius: 40px; margin: 0 auto; }
.phone .stage-bar { max-width: 390px; margin-left: auto; margin-right: auto; }
.howto { margin-top: 18px; padding: 14px 16px; border-radius: 12px; background: var(--panel); border: 1px solid var(--line); font-size: 0.9rem; }
.howto h3 { margin-top: 0; }
.howto dl { margin: 0; display: grid; gap: 8px; }
.howto dt { font-weight: 700; }
.howto dd { margin: 0; color: var(--muted); }
.results { border-top: 1px solid var(--line); padding: 40px 0 0; scroll-margin-top: 64px; }
.results h2 { margin: 0 0 8px; }
.results p { color: var(--muted); margin: 0 0 12px; max-width: 70ch; }
.results textarea { width: 100%; min-height: 220px; font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
.results-bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 10px; }
.copied { color: var(--good); font-size: 0.9rem; }
footer { max-width: 1240px; margin: 0 auto; padding: 0 16px 40px; color: var(--muted); font-size: 0.85rem; }
</style>
</head>
<body>
<div class="top"><div class="top-inner">
  <strong>Zoom transition review demo</strong>
  <nav aria-label="Scenarios">${SCENARIOS.map((s, i) => `<a href="#s-${s.id}">${i + 1}. ${s.short}</a>`).join("")}<a href="#results">Results</a></nav>
  <div class="controls">
    <div class="seg" role="group" aria-label="Library version">
      <button type="button" data-lib="fixed" aria-pressed="true">Fixed library</button>
      <button type="button" data-lib="original" aria-pressed="false">Original (as received)</button>
    </div>
    <div class="seg" role="group" aria-label="Animation speed">
      <button type="button" data-speed="1" aria-pressed="true">Normal</button>
      <button type="button" data-speed="0.25" aria-pressed="false">Slow (¼)</button>
      <button type="button" data-speed="0.08" aria-pressed="false">Super slow</button>
    </div>
    <div class="seg" role="group" aria-label="Close button timing">
      <button type="button" data-close="after" aria-pressed="true">✕ after landing</button>
      <button type="button" data-close="flight" aria-pressed="false">✕ with flight</button>
    </div>
  </div>
</div></div>
<main>
  <div class="intro">
    <h1>See the zoom transitions for yourself</h1>
    <p>Each framed area below (a “stage”) is a small, separate website built with the library. Click the cards inside a stage to try it. Everything runs from this one file: no internet connection, installs or server needed.</p>
    <p><b>Fixed library</b> (top right) is the version with my fixes. <b>Original</b> is the library exactly as you sent it; switch to it to compare any “Fixed” note. Use <b>Slow</b> to judge the motion frame by frame. A status bar at the bottom of each stage reads <b>clean ✓</b> when nothing was left behind.</p>
    <p>Tick each note that matches what you see. When you’re done, the <a href="#results">Results</a> box at the bottom has everything as text to copy back to me. Your ticks are remembered in this browser.</p>
    <div class="legend"><span><span class="tag tag-good">Should</span> correct behaviour</span><span><span class="tag tag-fixed">Fixed</span> was a bug, now fixed</span><span><span class="tag tag-bad">Problem</span> still an issue</span><span><span class="tag tag-note">Note</span> a design choice</span></div>
  </div>
  ${scenarioHtml}
  <section class="results" id="results" aria-labelledby="h-results">
    <h2 id="h-results">Results to send back</h2>
    <p>This updates as you tick notes and type comments. Press Copy, then paste it into our conversation. It includes which library version and browser you used.</p>
    <div class="results-bar"><button type="button" id="copy">Copy results</button><button type="button" id="clear">Clear all ticks</button><span class="copied" id="copied" role="status"></span></div>
    <textarea id="out" readonly aria-label="Results text"></textarea>
  </section>
</main>
<footer>Built for the code review. Library source: <code>src/zoom/</code> (fixed); the original is the first commit. Demo source: <code>review/harness/</code>.</footer>
<script>
const decode = (b) => new TextDecoder().decode(Uint8Array.from(atob(b), (c) => c.charCodeAt(0)));
const BUNDLES = { fixed: decode(${JSON.stringify(b64(js))}), original: decode(${JSON.stringify(b64(jsOriginal))}) };
const REDUCED_STUB = ${JSON.stringify(REDUCED_STUB)};
const store = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
let speed = 1;
let closeTiming = "after";
let lib = "fixed";
const stageHtml = (scenario, reduced) =>
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Scenario: ' + scenario + '</title></head><body><div id="app"></div><script>window.ZOOM_DEMO=' +
  JSON.stringify({ scenario, timeScale: speed, closeTiming, simulatedReduced: reduced }) + ';' + (reduced ? REDUCED_STUB : '') + '<\\/script><script>' + BUNDLES[lib] + '<\\/script></body></html>';
const frames = [...document.querySelectorAll("iframe.stage")];
// Stages load from blob: URLs rather than srcdoc, so browser history (the Back button) works inside them.
const blobUrl = (f) => URL.createObjectURL(new Blob([stageHtml(f.dataset.scenario, f.hasAttribute("data-reduced"))], { type: "text/html" }));
const load = (f) => { if (f.dataset.url) URL.revokeObjectURL(f.dataset.url); f.dataset.url = blobUrl(f); f.src = f.dataset.url; f.dataset.loaded = "1"; };
const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting && !e.target.dataset.loaded) load(e.target); }), { rootMargin: "400px" });
frames.forEach((f) => io.observe(f));

/* ticks, comments and the results text */
const boxes = [...document.querySelectorAll("input[data-note]")];
const frees = [...document.querySelectorAll("textarea[data-free]")];
const KIND_LABEL = { should: "Should", fixed: "Fixed", problem: "Problem", note: "Note" };
const browser = () => {
  const ua = navigator.userAgent;
  // Checked in this order: Edge and Opera also say "Chrome"; Chrome also says "Safari".
  const m = ["Edg", "OPR", "Firefox", "Chrome", "Version"].map((k) => ua.match(new RegExp(k + "/([0-9.]+)"))).find(Boolean);
  const key = m ? m[0].split("/")[0] : "";
  const name = !m ? "Unknown browser" : key === "Edg" ? "Edge" : key === "OPR" ? "Opera" : key === "Version" ? "Safari" : key;
  const os = /Mac OS X/.test(ua) ? (/(iPhone|iPad)/.test(ua) ? "iOS" : "macOS") : /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /Linux/.test(ua) ? "Linux" : "";
  return name + (m ? " " + m[1].split(".")[0] : "") + (os ? " on " + os : "");
};
const render = () => {
  const lines = ["Zoom demo results", "Library: " + (lib === "fixed" ? "Fixed" : "Original (as received)") + " · ✕ timing: " + closeTiming + " · Browser: " + browser() + " · Reduced motion on device: " + (matchMedia("(prefers-reduced-motion: reduce)").matches ? "on" : "off"), "[x] = I saw this   [ ] = didn't see it, or didn't try", ""];
  document.querySelectorAll(".scenario").forEach((sec) => {
    const n = sec.dataset.n;
    lines.push(n + ". " + sec.dataset.title);
    sec.querySelectorAll("input[data-note]").forEach((b) => lines.push("  [" + (b.checked ? "x" : " ") + "] " + b.dataset.note + " " + KIND_LABEL[b.dataset.kind] + ": " + b.dataset.short));
    const free = sec.querySelector("textarea[data-free]").value.trim();
    if (free) lines.push("  Notes: " + free.replace(/\\n+/g, " / "));
    lines.push("");
  });
  document.getElementById("out").value = lines.join("\\n").trim() + "\\n";
};
const save = () => store.set("zoom-demo-results", { ticks: boxes.filter((b) => b.checked).map((b) => b.dataset.note), free: Object.fromEntries(frees.map((t) => [t.dataset.free, t.value])) });
const saved = store.get("zoom-demo-results");
if (saved) {
  boxes.forEach((b) => (b.checked = (saved.ticks || []).includes(b.dataset.note)));
  frees.forEach((t) => (t.value = (saved.free || {})[t.dataset.free] || ""));
}
document.addEventListener("change", (e) => { if (e.target.matches("input[data-note]")) { save(); render(); } });
document.addEventListener("input", (e) => { if (e.target.matches("textarea[data-free]")) { save(); render(); } });
document.getElementById("copy").addEventListener("click", async () => {
  render();
  const out = document.getElementById("out");
  let ok = false;
  try { await navigator.clipboard.writeText(out.value); ok = true; } catch {}
  if (!ok) { out.focus(); out.select(); try { ok = document.execCommand("copy"); } catch {} }
  document.getElementById("copied").textContent = ok ? "Copied. Paste it into our conversation." : "Select the text below and copy it (Ctrl/Cmd+C).";
});
document.getElementById("clear").addEventListener("click", () => { boxes.forEach((b) => (b.checked = false)); frees.forEach((t) => (t.value = "")); save(); render(); });
render();

document.addEventListener("click", (e) => {
  const t = e.target.closest("button"); if (!t) return;
  if (t.dataset.reload) load(document.querySelector('iframe[data-scenario="' + t.dataset.reload + '"]'));
  if (t.dataset.window) window.open(blobUrl(document.querySelector('iframe[data-scenario="' + t.dataset.window + '"]')), "_blank");
  if (t.dataset.speed) {
    speed = Number(t.dataset.speed);
    document.querySelectorAll("[data-speed]").forEach((b) => b.setAttribute("aria-pressed", String(b === t)));
    frames.forEach((f) => f.contentWindow && f.contentWindow.postMessage({ type: "zoom-demo-timescale", value: speed }, "*"));
  }
  if (t.dataset.close) {
    closeTiming = t.dataset.close;
    document.querySelectorAll("[data-close]").forEach((b) => b.setAttribute("aria-pressed", String(b === t)));
    frames.forEach((f) => f.contentWindow && f.contentWindow.postMessage({ type: "zoom-demo-close-timing", value: closeTiming }, "*"));
    render();
  }
  if (t.dataset.lib && t.dataset.lib !== lib) {
    lib = t.dataset.lib;
    document.querySelectorAll("[data-lib]").forEach((b) => b.setAttribute("aria-pressed", String(b === t)));
    document.querySelectorAll(".lib-name").forEach((s) => (s.textContent = lib === "fixed" ? "Fixed library" : "Original library"));
    frames.forEach((f) => f.dataset.loaded && load(f));
    render();
  }
});
</script>
</body>
</html>`;
}
