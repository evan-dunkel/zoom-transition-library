// Demo and probe app for the independent review. It uses the library exactly as it is
// in src/zoom (nothing here changes it). Which scenario renders is chosen by
// window.ZD, set by the page that loads this bundle.
import { StrictMode, useEffect, useRef, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { ZoomProvider, ZoomSource, ZoomHero, useZoom, type ZoomProviderProps } from "../../../src/zoom";
import baseCss from "../../../src/zoom/zoom.base.css";
import themeCss from "../../../src/zoom/zoom.theme.css";
import appCss from "./app.css";

type Scenario = "grid" | "scrolled" | "phone" | "reduced" | "rapid" | "slow" | "hscroll" | "big" | "keyboard" | "dupe" | "throw" | "scroll";
type Config = {
  scenario: Scenario;
  /** Number of items in the group. */
  n?: number;
  /** Wrap the app in React.StrictMode (probe only). */
  strict?: boolean;
  /** How long the big detail photos take to "download", in ms (slow scenario). */
  slowMs?: number;
  /** Probe only: load detail photos from this URL prefix instead of data: URLs. */
  heroUrl?: string;
  /** Provider prop overrides (probe only). */
  props?: Partial<ZoomProviderProps>;
  /** Set by the demo page when it simulates the reduced-motion setting. */
  simulatedReduced?: boolean;
  timeScale?: number;
};
declare global {
  interface Window {
    ZD: Config;
    __zd: { frames: number[]; worst: number; transitions: number };
  }
}
const cfg: Config = window.ZD ?? { scenario: "grid" };

for (const css of [baseCss, themeCss, appCss]) {
  const s = document.createElement("style");
  s.textContent = css;
  document.head.appendChild(s);
}

/* ------------------------------------------------------------------ content */

const PLACES: [string, string][] = [
  ["Salt Flats at Dawn", "Uyuni, Bolivia"],
  ["The Long Ridge", "Dolomites, Italy"],
  ["Harbour Fog", "Bergen, Norway"],
  ["Red Canyon Walk", "Utah, USA"],
  ["Tea Terraces", "Munnar, India"],
  ["Glacier Tongue", "Vatnajökull, Iceland"],
  ["Desert Bloom", "Atacama, Chile"],
  ["Pine Coast", "Hokkaido, Japan"],
  ["Lavender Rows", "Provence, France"],
  ["Basalt Shore", "Antrim, Ireland"],
  ["Cloud Forest", "Monteverde, Costa Rica"],
  ["Copper Hills", "Flinders Ranges, Australia"],
];
const COLORS = [
  ["#ffd6a5", "#ff9f80", "#6d597a", "#355070", "#1d2d44"],
  ["#bde0fe", "#a2d2ff", "#5e81ac", "#3b4c6b", "#22304a"],
  ["#e9edc9", "#ccd5ae", "#7f8f6a", "#4f5d47", "#2f3a2f"],
  ["#ffcdb2", "#e5989b", "#b5838d", "#6d6875", "#3d3a4b"],
  ["#d8f3dc", "#95d5b2", "#52b788", "#2d6a4f", "#1b4332"],
  ["#caf0f8", "#90e0ef", "#48cae4", "#0077b6", "#023e8a"],
  ["#fefae0", "#f4a261", "#e76f51", "#9c4a3a", "#4a2c2a"],
  ["#e0fbfc", "#98c1d9", "#3d5a80", "#293241", "#1a1f2b"],
  ["#f3e8ff", "#d0b3f5", "#9d79c9", "#5e4a85", "#2f2545"],
  ["#edf2f4", "#8d99ae", "#5c677d", "#2b2d42", "#14161f"],
  ["#d9ed92", "#99d98c", "#52b69a", "#168aad", "#1e6091"],
  ["#ffe8d6", "#ddbea9", "#b98b73", "#a5694f", "#6b4226"],
];
type Item = { id: string; title: string; place: string; seed: number };
const items = (prefix: string, n: number): Item[] =>
  Array.from({ length: n }, (_, i) => {
    const [title, place] = PLACES[i % PLACES.length];
    return { id: `${prefix}-${i + 1}`, title: n > PLACES.length ? `${title} ${Math.floor(i / PLACES.length) + 1}` : title, place, seed: i };
  });

/** A landscape "photo" as an SVG data: URL (1600×1000), so the demo needs no image files. */
const photoCache = new Map<number, string>();
function photo(seed: number) {
  const hit = photoCache.get(seed);
  if (hit) return hit;
  const p = COLORS[seed % COLORS.length];
  const r = (k: number) => (Math.sin(seed * 97.13 + k * 13.7) + 1) / 2;
  const ridge = (base: number, amp: number, k: number) => {
    let d = `M0 1000 L0 ${base}`;
    for (let x = 0; x <= 1600; x += 160) d += ` L${x} ${(base - amp * r(k + x / 160)).toFixed(0)}`;
    return d + " L1600 1000 Z";
  };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p[1]}"/><stop offset="1" stop-color="${p[0]}"/></linearGradient></defs><rect width="1600" height="1000" fill="url(#g)"/><circle cx="${320 + 960 * r(1)}" cy="${230 + 140 * r(2)}" r="${90 + 40 * r(3)}" fill="#fff" opacity=".75"/><path d="${ridge(640, 300, 4)}" fill="${p[2]}"/><path d="${ridge(770, 200, 9)}" fill="${p[3]}"/><path d="${ridge(890, 110, 15)}" fill="${p[4]}"/><text x="60" y="960" font-family="sans-serif" font-size="64" font-weight="700" fill="#fff" opacity=".85">#${seed + 1}</text></svg>`;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  photoCache.set(seed, url);
  return url;
}
const heroSrc = (it: Item) => (cfg.heroUrl ? `${cfg.heroUrl}/${it.id}.svg` : photo(it.seed));

const LOREM = [
  "We set off before first light, when the ground was still hard with frost and the only sound was our boots. By the time the sun cleared the far ridge the whole valley had turned the colour of apricots.",
  "The path climbs steadily for the first hour, then levels out along a shelf of pale rock. There is water at the second junction, but carry your own: the spring is unreliable after a dry month.",
  "Locals told us the light is best in the hour after sunrise and again just before dusk. They were right. At noon everything flattens into the same grey-green and the photographs look like postcards of somewhere else.",
  "We came down by the longer eastern route, which adds forty minutes but passes a small café that opens, as far as we could tell, whenever the owner feels like it.",
];

/* ------------------------------------------------------------------ pieces */

function Thumbs({ list, group, variant = "grid" }: { list: Item[]; group: string; variant?: "grid" | "rows" }) {
  const { open } = useZoom();
  return (
    <ul className={`tiles tiles-${variant}`}>
      {list.map((it) => (
        <li key={it.id}>
          <a
            className="tile"
            data-tile={it.id}
            href={`#/walks/${it.id}`}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
              e.preventDefault();
              open(it.id);
            }}
          >
            <ZoomSource id={it.id} group={group} as="span" className="thumb">
              <img src={photo(it.seed)} width={1600} height={1000} alt="" />
            </ZoomSource>
            <span className="tile-text">
              <span className="tile-title">{it.title}</span>
              <span className="tile-place">{it.place}</span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/** The detail photo. In the "slow" scenario it arrives late, like a big image on a slow connection. */
function HeroImage({ it }: { it: Item }) {
  const slow = cfg.slowMs ?? 0;
  const [ready, setReady] = useState(slow === 0 || loaded.has(it.id));
  useEffect(() => {
    if (ready) return;
    const t = setTimeout(() => {
      loaded.add(it.id);
      setReady(true);
    }, slow);
    return () => clearTimeout(t);
  }, [ready, it.id, slow]);
  // Width and height are given, so the browser reserves the space even before it loads.
  // Until it "arrives" it has no address and an empty description, so, like a real image still
  // downloading, it shows nothing of its own (not its description text).
  return <img src={ready ? heroSrc(it) : undefined} width={1600} height={1000} alt={ready ? `Photo: ${it.title}` : ""} />;
}
const loaded = new Set<string>();

function Detail({ it, extra }: { it: Item; extra?: ReactNode }) {
  if (cfg.scenario === "throw" && it.seed === 4) throw new Error(`Detail for ${it.id} failed to render`);
  return (
    <article className="detail">
      <ZoomHero className="d-hero">
        <HeroImage it={it} />
      </ZoomHero>
      <div className="d-body">
        <p className="d-place">{it.place}</p>
        <h2 className="d-title">{it.title}</h2>
        {extra}
        {LOREM.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        {LOREM.map((p, i) => (
          <p key={`b${i}`}>{p}</p>
        ))}
      </div>
    </article>
  );
}

/** Wide content inside a card: a photo strip and a table, each scrolling sideways on its own. */
function WideContent() {
  return (
    <>
      <p className="hint-inline">
        ↓ This strip scrolls sideways. Try a two-finger sideways swipe on a trackpad (or Shift + mouse wheel) over it.
      </p>
      <div className="strip" data-strip>
        {Array.from({ length: 10 }, (_, i) => (
          <img key={i} src={photo(i + 3)} width={1600} height={1000} alt="" />
        ))}
      </div>
      <div className="table-wrap" data-table>
        <table>
          <thead>
            <tr>
              {["Stage", "Start", "End", "Distance", "Ascent", "Descent", "Time", "Water", "Shelter", "Notes"].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4].map((r) => (
              <tr key={r}>
                {["Stage " + r, "06:10", "09:40", "11.2 km", "640 m", "210 m", "3h30", "Spring at km 6", "Hut", "Exposed after the col; carry a layer"].map((c, i) => (
                  <td key={i}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ status bar */

/** Small status bar for judging cleanup and smoothness. Not part of the library. */
function Status() {
  const [s, setS] = useState({ phase: "idle", copies: 0, hidden: 0, locked: false, worst: 0, focus: "" });
  const worst = useRef(0);
  useEffect(() => {
    window.__zd = { frames: [], worst: 0, transitions: 0 };
    let last = performance.now();
    let raf = 0;
    let busy = false;
    const loop = (now: number) => {
      const root = document.querySelector<HTMLElement>(".zoom-root");
      const phase = root?.dataset.phase ?? "idle";
      const moving = phase === "opening" || phase === "closing";
      if (moving && !busy) {
        busy = true;
        worst.current = 0;
        window.__zd.frames = [];
        window.__zd.transitions += 1;
      }
      if (busy) {
        const dt = now - last;
        window.__zd.frames.push(dt);
        worst.current = Math.max(worst.current, dt);
        window.__zd.worst = worst.current;
        if (!moving) busy = false;
      }
      last = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const id = setInterval(() => {
      const root = document.querySelector<HTMLElement>(".zoom-root");
      const a = document.activeElement as HTMLElement | null;
      const focus = !a || a === document.body ? "page (nothing)" : a.getAttribute("aria-label") || a.dataset.tile || a.textContent?.trim().slice(0, 24) || a.tagName.toLowerCase();
      setS({
        phase: root?.dataset.phase ?? "idle",
        copies: document.querySelectorAll(".zoom-clone").length,
        hidden: document.querySelectorAll("[data-zoom-hidden]").length,
        locked: document.documentElement.style.overflow === "hidden",
        worst: Math.round(worst.current),
        focus,
      });
    }, 120);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
    };
  }, []);
  const reduced = cfg.simulatedReduced || matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clean = s.phase === "idle" && s.copies === 0 && s.hidden === 0 && !s.locked;
  return (
    <div className="status" aria-hidden="true">
      <span>
        state <b>{s.phase}</b>
      </span>
      <span className={s.phase !== "idle" ? "" : clean ? "ok" : "bad"}>{s.phase !== "idle" ? "…" : clean ? "clean ✓" : "leftovers ✗"}</span>
      <span title="Longest gap between two frames during the last transition. 17 ms = perfectly smooth at 60 fps.">
        slowest frame <b className={s.worst > 50 ? "bad" : s.worst > 25 ? "warn" : ""}>{s.worst || "–"} ms</b>
      </span>
      <span>focus: {s.focus}</span>
      <span>reduced motion: {reduced ? (cfg.simulatedReduced ? "on (simulated)" : "on (your device)") : "off"}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ rapid-click tester */

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
function clickAt(x: number, y: number) {
  const el = document.elementFromPoint(x, y);
  if (!el) return;
  const o = { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, view: window };
  el.dispatchEvent(new PointerEvent("pointerdown", { ...o, pointerType: "mouse" }));
  el.dispatchEvent(new MouseEvent("mousedown", o));
  el.dispatchEvent(new PointerEvent("pointerup", { ...o, pointerType: "mouse" }));
  el.dispatchEvent(new MouseEvent("mouseup", o));
  el.dispatchEvent(new MouseEvent("click", o));
}
function clickTile(id: string) {
  const r = document.querySelector(`[data-tile="${id}"] .thumb`)!.getBoundingClientRect();
  clickAt(r.left + r.width / 2, r.top + r.height / 2);
}
const key = (k: string) => window.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));

function Rapid({ list }: { list: Item[] }) {
  const [log, setLog] = useState("Press a button, keep your hands off, and watch. Then try the same things by hand.");
  const ids = list.map((i) => i.id);
  const run = (name: string, fn: () => Promise<void>) => async () => {
    setLog(`Running “${name}”…`);
    await fn();
    await wait(1800);
    const phase = document.querySelector<HTMLElement>(".zoom-root")?.dataset.phase;
    setLog(`“${name}” finished. ${phase === "open" ? "A card is open (expected for some); press Esc." : "Check the status bar says clean ✓."}`);
  };
  const tests: [string, () => Promise<void>][] = [
    ["Double-click", async () => { clickTile(ids[1]); await wait(120); clickTile(ids[1]); }],
    ["10 fast clicks on two cards", async () => { for (let i = 0; i < 10; i++) { clickTile(ids[i % 2]); await wait(60); } }],
    ["Open, Esc halfway", async () => { clickTile(ids[2]); await wait(200); key("Escape"); }],
    ["Open, browser Back halfway", async () => { clickTile(ids[3]); await wait(200); history.back(); }],
    ["Close, then click it as it flies home", async () => { clickTile(ids[4]); await wait(800); key("Escape"); await wait(80); clickTile(ids[4]); }],
    ["Open, arrow keys ×4 fast", async () => { clickTile(ids[0]); await wait(150); for (let i = 0; i < 4; i++) { key("ArrowRight"); await wait(50); } await wait(700); key("Escape"); }],
    ["30 random actions", async () => {
      let seed = 11;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 30; i++) {
        const r = rnd();
        if (r < 0.45) clickTile(ids[Math.floor(rnd() * ids.length)]);
        else if (r < 0.6) key("Escape");
        else if (r < 0.7) { if (location.hash.length > 1) history.back(); }
        else if (r < 0.85) key(rnd() < 0.5 ? "ArrowLeft" : "ArrowRight");
        else clickAt(innerWidth / 2, 10);
        await wait(40 + rnd() * 160);
      }
      await wait(700);
      key("Escape");
    }],
  ];
  return (
    <section className="tester">
      <div className="tester-buttons">
        {tests.map(([n, fn]) => (
          <button key={n} type="button" onClick={run(n, fn)}>
            {n}
          </button>
        ))}
      </div>
      <p className="tester-log" role="status">
        {log}
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ scenarios */

function Header({ sticky }: { sticky?: boolean }) {
  return (
    <header className={sticky ? "site-header sticky" : "site-header"}>
      <span className="logo">Field Notes</span>
      <nav>
        <a href="#x" onClick={(e) => e.preventDefault()}>Journal</a>
        <a href="#x" onClick={(e) => e.preventDefault()}>Places</a>
        <a href="#x" onClick={(e) => e.preventDefault()}>About</a>
      </nav>
    </header>
  );
}
const filler = (n: number) =>
  Array.from({ length: n }, (_, i) => (
    <p key={i} className="filler">
      Ordinary page text, so there is something to scroll past. Paragraph {i + 1}. Real pages put articles, navigation
      and footers around the things that zoom.
    </p>
  ));

function App() {
  const s = cfg.scenario;
  const n = cfg.n ?? (s === "big" ? 48 : s === "phone" ? 8 : s === "scrolled" ? 6 : 9);
  const list = items(s, n);
  const byId = new Map(list.map((i) => [i.id, i]));
  const extra = s === "hscroll" ? <WideContent /> : s === "keyboard" ? <KeyboardExtras /> : s === "scroll" ? <CaseStudyExtras /> : null;
  const props: ZoomProviderProps = {
    renderDestination: (id) => <Detail it={byId.get(id)!} extra={extra} />,
    getLabel: (id) => byId.get(id)?.title ?? id,
    timeScale: cfg.timeScale ?? 1,
    // The links' own addresses (#/walks/…), so a link opened in a new tab or reloaded opens its card.
    ...(s === "rapid" ? { history: { mode: "session" as const, url: (id: string) => `#/walks/${id}` } } : {}),
    ...(s === "scroll" ? { presentation: "scroll" as const } : {}),
    ...cfg.props,
  };
  let page: ReactNode;
  if (s === "scrolled") {
    page = (
      <>
        <Header sticky />
        <main className="page">
          <h1>A long page</h1>
          <p className="lede">Scroll down to “Featured walks”.</p>
          {filler(10)}
          <h2>Featured walks</h2>
          <Thumbs list={list} group={s} />
          {filler(8)}
        </main>
      </>
    );
  } else if (s === "phone") {
    page = (
      <>
        <Header sticky />
        <main className="page page-narrow">
          <h1>Walks</h1>
          <Thumbs list={list} group={s} variant="rows" />
        </main>
      </>
    );
  } else if (s === "dupe") {
    // The same walk shown twice: as a big "featured" tile and again in the grid.
    const featured = list[4];
    page = (
      <>
        <Header />
        <main className="page">
          <h1>Featured</h1>
          <div className="featured">
            <Thumbs list={[featured]} group={s} />
          </div>
          <h2>All walks</h2>
          <Thumbs list={list} group={s} />
        </main>
      </>
    );
  } else {
    page = (
      <>
        <Header />
        <main className="page">
          <h1>{s === "big" ? `A large gallery (${n} walks)` : s === "scroll" ? "Selected work" : "Places we walked this year"}</h1>
          {s === "rapid" && <Rapid list={list} />}
          <Thumbs list={list} group={s} />
        </main>
      </>
    );
  }
  return (
    <ZoomProvider {...props}>
      {page}
      <Status />
    </ZoomProvider>
  );
}

/** Case-study-length content: pictures between the paragraphs, so each card is long. */
function CaseStudyExtras() {
  return (
    <>
      <p className="d-lead">A case study: the problem, what we tried, and what shipped. Scroll on past the end to reach the next project.</p>
      {[2, 5, 8].map((seed) => (
        <figure key={seed} className="d-figure">
          <img src={photo(seed)} width={1600} height={1000} alt="" />
          <figcaption>Figure: an early prototype, tested with five people.</figcaption>
        </figure>
      ))}
    </>
  );
}

function KeyboardExtras() {
  return (
    <p>
      <label className="note">
        A text field inside the card <input type="text" defaultValue="Arrow keys move this cursor" />
      </label>{" "}
      <a href="#more" onClick={(e) => e.preventDefault()}>
        A link inside the card
      </a>
    </p>
  );
}

const root = createRoot(document.getElementById("app")!);
root.render(cfg.strict ? <StrictMode><App /></StrictMode> : <App />);
