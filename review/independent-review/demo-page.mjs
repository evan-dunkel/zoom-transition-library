// Builds zoom-demo.html: one self-contained file. Each scenario runs in its own frame (a
// blob: URL made at runtime from the one embedded bundle), so each is an independent little
// website, and the phone scenario gets a real 390 px wide window. A checklist under each
// scenario records what the viewer saw; "Copy results" puts it on the clipboard as text.

// k: "ok" = should work (confirm it), "bug" = a problem I found (confirm you see it), "look" = judge it yourself.
const SCENARIOS = [
  {
    id: "grid",
    title: "1. Card grid zooming into detail pages",
    what: "A grid of walks. Click a picture: it flies into a detail card while the card grows around it. The neighbouring walks peek in at the sides (← → or a sideways trackpad swipe moves between them). Close with Esc, the ✕, a click on the dimmed area, or by scrolling up past the top of the card.",
    checks: [
      { k: "ok", t: "The picture leaves exactly from its thumbnail and lands exactly at the top of the card, with no jump at either end. (Turn on slow motion at the top to see it clearly.)" },
      { k: "ok", t: "Closing sends the picture back into its own thumbnail, and the page looks exactly as before." },
      { k: "look", t: "The motion feels good to you: speed, slight bounce, the way the card grows out of the picture." },
      { k: "bug", t: "At the moment you click, the other thumbnails on the page blink out (most visible on the second row), and stay hidden until the card has closed." },
      { k: "bug", t: "In slow motion, the ✕ button can be seen floating just outside the top-right of the growing card during the first part of the opening." },
      { k: "look", t: "Page turns (← →): try the “Page turn” switch at the top of this page. Which setting feels right on your display? (Say which in the note.)" },
    ],
  },
  {
    id: "scrolled",
    title: "2. A scrolled page with a sticky header",
    what: "A long page whose header stays stuck to the top. The cards are further down: scroll to “Featured walks” before opening one.",
    checks: [
      { k: "ok", t: "After scrolling, the zoom still starts exactly from the thumbnail you clicked." },
      { k: "ok", t: "After closing, you are at the same scroll position as before." },
      { k: "bug", t: "Scroll so a thumbnail is half hidden under the header, then click its title. The hidden half pops out on top of the header in the first frame (and on closing it lands on top, then snaps underneath)." },
    ],
  },
  {
    id: "phone",
    title: "3. Narrow phone-width layout (390 px)",
    phone: true,
    what: "A phone-width list with small square thumbnails that open into full-height cards: a big change of shape. For touch, use “Open in new tab” and your browser's device mode (Chrome: Cmd/Ctrl+Shift+M), or open the file on a phone.",
    checks: [
      { k: "ok", t: "The picture grows from the small square into the wide picture at the top of the card, its crop changing smoothly with no jump." },
      { k: "ok", t: "Closing shrinks it back into its own square." },
      { k: "look", t: "(Touch, optional) Dragging down from the top of the card closes it; dragging sideways moves to the next walk." },
    ],
  },
  {
    id: "reduced",
    title: "4. Reduced motion (simulated in this frame)",
    reduced: true,
    what: "This frame pretends your device has “Reduce motion” turned on. To test the real setting, turn it on (instructions at the bottom of this page) and use the other frames: they follow your device setting.",
    checks: [
      { k: "ok", t: "Opening is instant: the card is simply there. Nothing flies, grows or fades." },
      { k: "ok", t: "Closing is instant too, and ← → switch walks without sliding." },
      { k: "look", t: "(Optional) With the real device setting turned on, frames 1–3 also open and close instantly, without reloading this page." },
    ],
  },
  {
    id: "rapid",
    title: "5. Rapid repeated clicks and interruptions",
    what: "The buttons in the frame run quick sequences by themselves: double-click, ten fast clicks, Esc or Back half way, clicking a card as it flies home, random input. Try the same by hand too. Browser history is on here, so Back closes the card.",
    checks: [
      { k: "ok", t: "After each sequence settles, the dark status bar at the bottom says “clean ✓” (press Esc first if a card is left open)." },
      { k: "ok", t: "Clicking a card while it shrinks home turns it around smoothly instead of restarting." },
      { k: "look", t: "Nothing ever gets stuck, flickers, or ends up in the wrong place." },
    ],
  },
  {
    id: "slow",
    title: "6. Detail photos that are still downloading",
    what: "On a real site the thumbnail and the big detail photo are different files, and the big one only starts downloading when you click. Here the big photos take 1.5 seconds to arrive the first time each card opens (they're remembered after that).",
    checks: [
      { k: "bug", t: "First open of each card: the thumbnail vanishes and an empty grey box (with the photo's description text in its corner) zooms up instead of the picture. The photo pops in later." },
      { k: "ok", t: "Second open of the same card: the picture flies properly." },
    ],
  },
  {
    id: "hscroll",
    title: "7. Content inside a card that scrolls sideways",
    what: "The detail cards contain a photo strip and a wide table, each meant to scroll sideways on its own. Open a card, scroll down a little to them, and try to scroll them sideways (two-finger sideways swipe on a trackpad, or Shift + mouse wheel).",
    checks: [
      { k: "bug", t: "The strip and the table don't scroll sideways; the swipe switches to the next walk instead." },
    ],
  },
  {
    id: "big",
    title: "8. A large gallery (48 walks)",
    what: "Opening any card also builds the cards for every walk in the group, so the first moment of the zoom does more work the bigger the gallery. Watch the “slowest frame” number in the status bar (17 ms is perfectly smooth; over about 50 ms is a visible hitch). On a fast computer it may look fine; on a mid-range phone it hitches.",
    checks: [
      { k: "look", t: "Note the “slowest frame” number after opening a card here, and compare it with scenario 1 (9 walks)." },
      { k: "look", t: "The picture hesitates for a moment before it starts to move (compare with scenario 1)." },
    ],
  },
  {
    id: "dupe",
    title: "9. The same walk shown twice (featured + grid)",
    what: "The walk at the top (“Tea Terraces”, shown big as a featured item) also appears in the grid below. Click the big featured picture.",
    checks: [
      { k: "bug", t: "The zoom does not start from the picture you clicked: the featured picture stays where it is, and the flying picture comes from the grid copy lower down (from below the bottom of the window)." },
    ],
  },
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const LABEL = { ok: "Should work", bug: "Problem I found", look: "Your judgement" };

export function makeDemo(js) {
  const sections = SCENARIOS.map(
    (s) => `
  <section class="scenario" id="s-${s.id}" data-id="${s.id}">
    <header class="s-head">
      <h2>${esc(s.title)}</h2>
      <div class="s-actions">
        <button type="button" data-reload="${s.id}">Reload</button>
        <button type="button" data-window="${s.id}">Open in new tab</button>
      </div>
    </header>
    <p class="what">${s.what}</p>
    <div class="frame-wrap${s.phone ? " phone" : ""}">
      <iframe class="stage" title="${esc(s.title)}" data-scenario="${s.id}"${s.reduced ? " data-reduced" : ""}></iframe>
    </div>
    <h3 class="look">What to look for</h3>
    <ol class="checks">
      ${s.checks
        .map(
          (c, i) => `<li class="check" data-key="${s.id}-${i}">
        <div class="check-text"><span class="tag tag-${c.k}">${LABEL[c.k]}</span> ${c.t}</div>
        <div class="answers" role="radiogroup" aria-label="Result">
          ${["Yes", "No", "Unsure"].map((a) => `<label><input type="radio" name="${s.id}-${i}" value="${a}"> ${a}</label>`).join("")}
          <input type="text" class="note" placeholder="Note (optional)" aria-label="Note">
        </div>
      </li>`,
        )
        .join("")}
    </ol>
  </section>`,
  ).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Zoom Library Demo</title>
<style>
:root {
  --bg: #f4f2ee; --surface: #fff; --ink: #1d1e22; --muted: #5d6068; --line: #dedad2;
  --accent: #2f5d50; --ok: #2f7a4f; --bug: #b3412e; --look: #6a55a8;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --bg: #16171a; --surface: #202227; --ink: #ecebe8; --muted: #a3a6ad; --line: #34363c; --accent: #8cc4b1; --ok: #79c99a; --bug: #f08f7c; --look: #b7a6ee; }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.wrap { max-width: 1180px; margin: 0 auto; padding: 0 16px 80px; }
.top { position: sticky; top: 0; z-index: 5; background: color-mix(in srgb, var(--bg) 92%, transparent); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); }
.top .wrap { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 20px; padding: 10px 16px; }
.top h1 { font-size: 1.05rem; margin: 0; }
.top label { font-size: 0.9rem; color: var(--muted); display: inline-flex; gap: 6px; align-items: center; }
.top nav { display: flex; flex-wrap: wrap; gap: 4px 10px; font-size: 0.85rem; }
.top nav a { color: var(--accent); text-decoration: none; }
button { font: inherit; font-size: 0.88rem; padding: 6px 12px; border-radius: 8px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); cursor: pointer; }
button.primary { background: var(--accent); color: var(--bg); border-color: var(--accent); font-weight: 600; }
.intro { padding: 28px 0 8px; max-width: 72ch; }
.intro h2 { font-size: 1.6rem; margin: 0 0 8px; }
.intro p { color: var(--muted); margin: 0 0 10px; }
.scenario { margin: 36px 0 0; padding: 20px; background: var(--surface); border: 1px solid var(--line); border-radius: 16px; }
.s-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; }
.s-head h2 { margin: 0; font-size: 1.25rem; }
.s-actions { display: flex; gap: 6px; }
.what { color: var(--muted); max-width: 80ch; margin: 8px 0 14px; }
.frame-wrap { border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: #f6f3ee; }
.frame-wrap iframe { display: block; width: 100%; height: 640px; border: 0; }
.frame-wrap.phone { width: 392px; max-width: 100%; margin: 0 auto; border-radius: 28px; border-width: 8px; border-color: #2a2b30; }
.frame-wrap.phone iframe { height: 760px; }
.look { font-size: 0.95rem; margin: 18px 0 6px; }
.checks { margin: 0; padding-left: 22px; }
.check { padding: 10px 0; border-top: 1px solid var(--line); }
.check:first-child { border-top: 0; }
.check-text { margin-bottom: 6px; }
.tag { display: inline-block; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; padding: 1px 7px; border-radius: 999px; margin-right: 4px; vertical-align: 1px; color: var(--surface); }
.tag-ok { background: var(--ok); } .tag-bug { background: var(--bug); } .tag-look { background: var(--look); }
.answers { display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: center; font-size: 0.9rem; }
.answers label { display: inline-flex; gap: 4px; align-items: center; cursor: pointer; }
.note { flex: 1 1 220px; min-width: 0; font: inherit; font-size: 0.88rem; padding: 4px 8px; border: 1px solid var(--line); border-radius: 6px; background: var(--bg); color: var(--ink); }
.help { margin-top: 40px; padding: 20px; border: 1px solid var(--line); border-radius: 16px; background: var(--surface); }
.help h2 { margin-top: 0; font-size: 1.2rem; }
.help h3 { font-size: 1rem; margin: 16px 0 4px; }
.help ul { margin: 4px 0; padding-left: 20px; }
.results { margin-top: 40px; padding: 20px; border: 2px solid var(--accent); border-radius: 16px; background: var(--surface); }
.results h2 { margin-top: 0; font-size: 1.2rem; }
.results textarea.general { min-height: 100px; font: inherit; font-size: 0.92rem; margin-bottom: 8px; }
.results textarea { width: 100%; min-height: 160px; font: 13px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; padding: 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--ink); }
.results .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 8px 0; }
.copied { color: var(--ok); font-weight: 600; }
@media (max-width: 640px) { .frame-wrap iframe { height: 560px; } .scenario { padding: 14px; } }
</style>
</head>
<body>
<div class="top"><div class="wrap">
  <h1>Zoom library demo</h1>
  <label>Speed <select id="speed"><option value="1">Normal</option><option value="0.3">Slow motion (×0.3)</option><option value="0.1">Very slow (×0.1)</option></select></label>
  <label>Page turn <select id="pageTiming"><option value="">Library default (0.5 s)</option><option value="0.35">0.35 s, no bounce</option><option value="0.3b">0.3 s, slight bounce</option></select></label>
  <nav>${SCENARIOS.map((s) => `<a href="#s-${s.id}">${s.title.split(". ")[0]}</a>`).join("")}<a href="#help">Reduced motion help</a><a href="#results">Results</a></nav>
</div></div>
<div class="wrap">
  <div class="intro">
    <h2>See the zoom transitions for yourself</h2>
    <p>Each box below is a small, separate website running the library exactly as it is in the repository (nothing changed). Under each one is a checklist. Items marked <span class="tag tag-ok">Should work</span> are things I measured as correct; please confirm they look right to you. <span class="tag tag-bug">Problem I found</span> items are issues from my report; please confirm you can see them. <span class="tag tag-look">Your judgement</span> items need a designer's eye.</p>
    <p>When you're done, press <b>Copy results</b> at the bottom and paste the text back to me. Your answers are kept if you reload this page in the same browser. The dark bar at the bottom of each frame is a diagnostic I added (it's not part of the library): it shows whether anything was left behind after a transition, the slowest frame, and where keyboard focus is.</p>
  </div>
${sections}
  <section class="help" id="help">
    <h2>How to turn on reduced motion on your device</h2>
    <p>Turn it on, come back to this page, and open a card in scenarios 1–3. They should open and close instantly. No reload is needed.</p>
    <h3>Mac</h3><ul><li>System Settings → Accessibility → Display → turn on <b>Reduce motion</b>.</li></ul>
    <h3>iPhone / iPad</h3><ul><li>Settings → Accessibility → Motion → turn on <b>Reduce Motion</b>.</li></ul>
    <h3>Windows 11</h3><ul><li>Settings → Accessibility → Visual effects → turn off <b>Animation effects</b>.</li></ul>
    <h3>Windows 10</h3><ul><li>Settings → Ease of Access → Display → turn off <b>Show animations in Windows</b>.</li></ul>
    <h3>Android</h3><ul><li>Settings → Accessibility → turn on <b>Remove animations</b> (on some phones: Accessibility → Visibility enhancements, or Color and motion).</li></ul>
    <h3>Without changing your settings (Chrome or Edge)</h3><ul><li>Open DevTools (F12 or Cmd+Option+I), press Cmd/Ctrl+Shift+P, type <b>reduced motion</b>, and choose “Emulate CSS prefers-reduced-motion: reduce”. It applies to this tab only while DevTools is open.</li></ul>
    <p>The status bar inside each frame shows “reduced motion: on (your device)” when the setting is detected.</p>
  </section>
  <section class="results" id="results">
    <h2>Results</h2>
    <p>Optional: which browser and device you used.</p>
    <div class="row"><input type="text" class="note" id="env" placeholder="e.g. Safari on MacBook Air, iPhone 13" aria-label="Browser and device"></div>
    <p>Anything else: general notes, ideas, things the checklist didn't ask about.</p>
    <textarea id="general" class="general" aria-label="General notes" placeholder="General notes"></textarea>
    <div class="row"><button type="button" class="primary" id="copy">Copy results</button><span id="copied" class="copied" aria-live="polite"></span></div>
    <textarea id="out" readonly aria-label="Results text"></textarea>
  </section>
</div>
<script>
const BUNDLE = ${JSON.stringify(js).replace(/<\//g, "<\\/")};
const SCENARIOS = ${JSON.stringify(SCENARIOS.map((s) => ({ id: s.id, title: s.title, checks: s.checks.map((c) => ({ k: c.k, t: c.t })) })))};
// Simulated reduced motion: the library reads window.matchMedia, so answer "reduce" to it.
const REDUCED_STUB = "(function(){var m=window.matchMedia.bind(window);window.matchMedia=function(q){if(/prefers-reduced-motion:\\\\s*reduce/.test(q)){return{matches:true,media:q,onchange:null,addEventListener:function(){},removeEventListener:function(){},addListener:function(){},removeListener:function(){},dispatchEvent:function(){return false}}}return m(q)}})();";
const speedEl = document.getElementById("speed");
const pageEl = document.getElementById("pageTiming");
// Passed to the provider as its timing.page prop (a public option; the library itself is unchanged).
const PAGE_TIMINGS = { "0.35": { duration: 0.35, bounce: 0 }, "0.3b": { duration: 0.3, bounce: 0.1 } };
function stageHtml(id, reduced) {
  const cfg = { scenario: id, timeScale: +speedEl.value, simulatedReduced: reduced };
  const pt = PAGE_TIMINGS[pageEl.value];
  if (pt) cfg.props = { timing: { page: pt } };
  if (id === "slow") cfg.slowMs = 1500;
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + id + '</title></head><body><div id="app"></div><script>' + (reduced ? REDUCED_STUB : "") + 'window.ZD=' + JSON.stringify(cfg) + ';<\\/script><script>' + BUNDLE.replace(/<\\/script/gi, "<\\\\/script") + '<\\/script></body></html>';
}
// Frames load from blob: URLs (not srcdoc) so browser history, and so the Back button, works inside them.
const urlFor = (f) => URL.createObjectURL(new Blob([stageHtml(f.dataset.scenario, f.hasAttribute("data-reduced"))], { type: "text/html" }));
function load(f) { if (f.dataset.url) URL.revokeObjectURL(f.dataset.url); f.dataset.url = urlFor(f); f.src = f.dataset.url; }
const frames = [...document.querySelectorAll("iframe.stage")];
// Load each frame when it comes near the screen, so the page opens quickly.
const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting && !e.target.dataset.url) load(e.target); }), { rootMargin: "400px" });
frames.forEach((f) => io.observe(f));
const reloadAll = () => frames.forEach((f) => { if (f.dataset.url) load(f); });
speedEl.addEventListener("change", reloadAll);
pageEl.addEventListener("change", reloadAll);
document.addEventListener("click", (e) => {
  const t = e.target.closest("button"); if (!t) return;
  if (t.dataset.reload) load(document.querySelector('iframe[data-scenario="' + t.dataset.reload + '"]'));
  if (t.dataset.window) window.open(urlFor(document.querySelector('iframe[data-scenario="' + t.dataset.window + '"]')), "_blank");
});

// Checklist: kept in this browser between reloads (if storage is available), and written out as text.
const KEY = "zoom-demo-results-v1";
let saved = {};
try { saved = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) {}
document.querySelectorAll(".check").forEach((li) => {
  const k = li.dataset.key; const v = saved[k] || {};
  if (v.a) { const r = li.querySelector('input[value="' + v.a + '"]'); if (r) r.checked = true; }
  if (v.n) li.querySelector(".note").value = v.n;
});
if (saved.env) document.getElementById("env").value = saved.env;
if (saved.general) document.getElementById("general").value = saved.general;
function collect() {
  const data = { env: document.getElementById("env").value, general: document.getElementById("general").value.trim() };
  document.querySelectorAll(".check").forEach((li) => {
    const a = li.querySelector("input[type=radio]:checked"); const n = li.querySelector(".note").value.trim();
    data[li.dataset.key] = { a: a ? a.value : "", n };
  });
  return data;
}
function render() {
  const d = collect();
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
  const lines = ["Zoom demo results" + (d.env ? " (" + d.env + ")" : ""), "Reduced motion on this device: " + (matchMedia("(prefers-reduced-motion: reduce)").matches ? "on" : "off") + "; window " + innerWidth + "x" + innerHeight, ""];
  SCENARIOS.forEach((s) => {
    lines.push(s.title);
    s.checks.forEach((c, i) => {
      const v = d[s.id + "-" + i] || {};
      lines.push("  " + (i + 1) + ". [" + (v.a || "not answered") + "] " + ({ ok: "(should work) ", bug: "(problem) ", look: "(judgement) " })[c.k] + c.t.slice(0, 90) + (c.t.length > 90 ? "…" : "") + (v.n ? "\\n     note: " + v.n : ""));
    });
    lines.push("");
  });
  lines.push("Page-turn setting in use: " + pageEl.options[pageEl.selectedIndex].text);
  if (d.general) lines.push("", "General notes:", d.general);
  document.getElementById("out").value = lines.join("\\n");
}
document.addEventListener("input", render);
document.addEventListener("change", render);
render();
document.getElementById("copy").addEventListener("click", async () => {
  render();
  const ta = document.getElementById("out"); const msg = document.getElementById("copied");
  try { await navigator.clipboard.writeText(ta.value); msg.textContent = "Copied. Paste it into your reply."; }
  catch (e) { ta.focus(); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch (e2) {} msg.textContent = ok ? "Copied. Paste it into your reply." : "Select the text below and copy it (Cmd/Ctrl+C)."; }
});
</script>
</body>
</html>`;
}
