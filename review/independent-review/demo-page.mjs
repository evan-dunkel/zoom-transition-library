// Builds zoom-demo.html: one self-contained file. Each scenario runs in its own frame (a
// blob: URL made at runtime from the one embedded bundle), so each is an independent little
// website, and the phone scenario gets a real 390 px wide window. A checklist under each
// scenario records what the viewer saw; "Copy results" puts it on the clipboard as text.

// k: "ok" = should work (confirm it), "fixed" = a problem from the report that is now fixed (confirm
// it's gone), "known" = a limitation that remains, "look" = judge it yourself.
const SCENARIOS = [
  {
    id: "scroll",
    title: "1. NEW: vertical scroll (portfolio mode)",
    what: "The new presentation mode, set with one option (<code>presentation=\"scroll\"</code>). Tap a project: only that one grows into its card. The rest of the page dims to a low opacity in step with the flight, and the tapped thumbnail's place is left empty. The cards form one continuous column, each as long as its content, so you can read straight on from one case study into the next. Close with Esc, the ✕, a click beside the column, or a sideways swipe.",
    checks: [
      { k: "new", t: "Only the tapped project grows into its card; nothing else zooms. The other thumbnails dim to a low opacity in step with the flight, and the tapped one's place is empty once it has landed." },
      { k: "new", t: "Scrolling is continuous: there's no friction or snap between one project and the next, and each card is as long as its content (the page scrolls, not a box inside the card)." },
      { k: "new", t: "As you scroll on to the next project, its thumbnail on the page behind fades to empty, and the previous one fades back to the low opacity." },
      { k: "new", t: "Close (Esc or ✕) while reading a later project: that project's card flies back into its own empty place. The neighbouring cards fade and shrink a little where they are, without flying to their thumbnails, and the rest of the page fades back to full." },
      { k: "look", t: "Does this feel right for hiring managers reading one project after another? Anything you'd tune (the 0.2 dim level, the amount the neighbours shrink, the speed)?" },
    ],
  },
  {
    id: "grid",
    title: "2. Card grid zooming into detail pages (the horizontal mode, unchanged)",
    what: "The original presentation: a horizontal pager. Click a picture: it flies into a detail card while the card grows around it, and the neighbouring walks peek in at the sides (← → or a sideways swipe moves between them). Kept as it was.",
    checks: [
      { k: "ok", t: "Everything you confirmed last time still holds: exact take-off and landing, thumbnails fading instead of blinking out, only the visible card showing a ✕, quick page turns." },
      { k: "look", t: "The ✕ grows and slides in with the card as the card's clip opens (you noted it scales and drifts in like the other card elements). Is that right, or would you rather it simply faded in, in place, at its final size?" },
    ],
  },
  {
    id: "scrolled",
    title: "3. A scrolled page with a sticky header",
    what: "Scroll down to “Featured walks”, then scroll so a thumbnail is partly hidden under the header, and open it by clicking its title.",
    checks: [
      { k: "fixed", t: "Taking off and landing, the flying picture is now cut straight across at the header line, as if it slides under the header, at its full height with its own rounded corners. No shorter rounded box, and no pop when it lands." },
      { k: "ok", t: "After closing, you are at the same scroll position as before." },
    ],
  },
  {
    id: "phone",
    title: "4. Narrow phone-width layout (390 px)",
    phone: true,
    what: "A phone-width list with small square thumbnails that open into full-height cards. Use “Reload” on this box before each try of a first open.",
    checks: [
      { k: "fixed", t: "First open after loading: the zoom no longer jumps ahead. The picture waits on its thumbnail for an instant (while the browser prepares the images, at most about 0.1 s), then the whole movement plays smoothly from the start." },
      { k: "known", t: "In this horizontal mode the neighbouring cards appear beside the opened card and grow with it (they don't come from their own thumbnails on the way in); on closing, they fly back to their own thumbnails. That's how this mode works; the new scroll mode (scenario 1) doesn't zoom the neighbours at all." },
    ],
  },
  {
    id: "reduced",
    title: "5. Reduced motion (simulated in this frame)",
    reduced: true,
    what: "This frame pretends your device has “Reduce motion” turned on. Instructions for the real setting are at the bottom of this page.",
    checks: [
      { k: "ok", t: "Opening and closing are instant, and ← → switch walks without sliding." },
      { k: "look", t: "(Optional) With the real device setting turned on, the other boxes also open and close instantly, including the new scroll mode (scenario 1)." },
    ],
  },
  {
    id: "rapid",
    title: "6. Rapid repeated clicks, interruptions and shared links",
    what: "The buttons in the frame run quick sequences by themselves. Try the same by hand too. Browser history is on here: Back closes the card, and each open card has its own address, the same one its link points to (#/walks/…).",
    checks: [
      { k: "ok", t: "After each sequence settles, the status bar says “clean ✓”, and turn-arounds in slow motion curve back smoothly." },
      { k: "fixed", t: "Press “Open in new tab”, open a card there, then reload that tab: the card is open again. Close it: the #/walks/… disappears from the address. A card link Cmd/Ctrl-clicked into a new tab opens that card too." },
    ],
  },
  {
    id: "slow",
    title: "7. Detail photos that are still downloading",
    what: "Here the big photos take 1.5 seconds to arrive the first time each card opens. Reload this box to try first opens again.",
    checks: [
      { k: "fixed", t: "First open: the thumbnail's picture flies into the card and stays there (no grey box after landing) until the big photo arrives and takes over." },
      { k: "fixed", t: "The neighbouring cards show their own thumbnails' pictures too while their big photos download, instead of plain grey." },
    ],
  },
  {
    id: "hscroll",
    title: "8. Content inside a card that scrolls sideways",
    what: "Open a card, scroll down to the photo strip, and swipe it sideways until it reaches its end.",
    checks: [
      { k: "fixed", t: "When the strip reaches its end mid-swipe, the rest of that swipe still doesn't turn the page, but a new swipe now does at once, without moving the mouse first." },
    ],
  },
  {
    id: "big",
    title: "9. A large gallery (48 walks)",
    what: "Opening builds only the opened card and its neighbours; the rest are built after landing.",
    checks: [
      { k: "ok", t: "The picture starts moving promptly, and the slowest frame stays low (you saw 17 ms last time)." },
    ],
  },
  {
    id: "dupe",
    title: "10. The same walk shown twice (featured + grid)",
    what: "Click the big featured picture, close it; then try the copy in the grid.",
    checks: [{ k: "ok", t: "Each zooms from, and back to, the copy you clicked." }],
  },
  {
    id: "throw",
    title: "11. One item whose content is broken",
    what: "Walk 5 has a bug in its detail content. Open walk 4, then press → to reach walk 5.",
    checks: [{ k: "ok", t: "Walk 5's card shows “This item couldn’t be shown.” in the page's own text style; everything else keeps working." }],
  },
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const LABEL = { new: "New: confirm", ok: "Should work", fixed: "Fixed: confirm", known: "How it works", look: "Your judgement" };

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
  --accent: #2f5d50; --ok: #2f7a4f; --fixed: #1f6f8b; --known: #a2591d; --look: #6a55a8;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --bg: #16171a; --surface: #202227; --ink: #ecebe8; --muted: #a3a6ad; --line: #34363c; --accent: #8cc4b1; --ok: #79c99a; --fixed: #7cc7e4; --known: #f0b27c; --look: #b7a6ee; }
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
.tag-new { background: var(--accent); } .tag-ok { background: var(--ok); } .tag-fixed { background: var(--fixed); } .tag-known { background: var(--known); } .tag-look { background: var(--look); }
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
  <label>Page turn <select id="pageTiming"><option value="">Library default (0.25 s, no bounce)</option><option value="0.35">0.35 s, no bounce</option><option value="0.5">0.5 s (the old default)</option></select></label>
  <nav>${SCENARIOS.map((s) => `<a href="#s-${s.id}">${s.title.split(". ")[0]}</a>`).join("")}<a href="#help">Reduced motion help</a><a href="#results">Results</a></nav>
</div></div>
<div class="wrap">
  <div class="intro">
    <h2>See the zoom transitions for yourself</h2>
    <p>Each box below is a small, separate website running the library as it is now in the repository, with the fixes from the review. Under each one is a checklist. <span class="tag tag-new">New: confirm</span> items are the new vertical scroll mode (scenario 1). <span class="tag tag-fixed">Fixed: confirm</span> items are the things you reported last time; please confirm they're gone. <span class="tag tag-ok">Should work</span> items were already right. <span class="tag tag-known">How it works</span> items explain behaviour that is by design. <span class="tag tag-look">Your judgement</span> items need a designer's eye.</p>
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
const PAGE_TIMINGS = { "0.35": { duration: 0.35, bounce: 0 }, "0.5": { duration: 0.5, bounce: 0 } };
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
const KEY = "zoom-demo-results-v3";
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
      lines.push("  " + (i + 1) + ". [" + (v.a || "not answered") + "] " + ({ new: "(new) ", ok: "(should work) ", fixed: "(fixed?) ", known: "(how it works) ", look: "(judgement) " })[c.k] + c.t.slice(0, 90) + (c.t.length > 90 ? "…" : "") + (v.n ? "\\n     note: " + v.n : ""));
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
