// Demo + test app. Uses the library exactly as shipped (../../../src/zoom).
// Which scenario renders is chosen by window.ZOOM_DEMO, set by the page that loads it.
import { useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { ZoomProvider, ZoomSource, ZoomHero, TemplateDestination, useZoom, type ZoomProviderProps } from "../../../src/zoom";
import zoomCss from "../../../src/zoom/zoom.css";
import appCss from "./app.css";
import { Art, Body, artDataUri, entries, type Entry } from "./content";

type Config = {
  scenario: "portfolio" | "grid" | "scrolled" | "mobile" | "reduced" | "rapid" | "late" | "carousel" | "keyboard" | "template";
  /** Test-only: late scenario loads real image URLs from here (the test delays them) instead of a timer. */
  lateUrl?: string;
  /** Test-only: fly the hero as a still snapshot (ZoomHero live={false}). */
  heroLive?: boolean;
  timeScale?: number;
  /** The provider's closeButtonTiming. */
  closeTiming?: "after" | "flight";
  /** Shown in the status bar when the reduced-motion media query is being simulated. */
  simulatedReduced?: boolean;
  /** Test-only provider overrides. */
  props?: Partial<ZoomProviderProps>;
};
declare global {
  interface Window {
    ZOOM_DEMO: Config;
    __zoomDemo?: { setTimeScale(v: number): void };
  }
}
const config: Config = window.ZOOM_DEMO ?? { scenario: "grid" };

for (const css of [zoomCss, appCss]) {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
}

const byId = new Map<string, Entry>();
const list = (prefix: string, n?: number) => {
  const e = entries(prefix, n);
  e.forEach((x) => byId.set(x.id, x));
  return e;
};

/* ---------------------------------------------------------------- pieces */

function Tiles({ items, group, variant = "grid" }: { items: Entry[]; group: string; variant?: "grid" | "row" | "carousel" }) {
  const { open } = useZoom();
  return (
    <ul className={`tiles tiles-${variant}`}>
      {items.map((e) => (
        <li key={e.id}>
          <button type="button" className="tile" data-tile={e.id} onClick={() => open(e.id)}>
            <ZoomSource id={e.id} group={group} as="span" className="thumb">
              <Art seed={e.seed} />
            </ZoomSource>
            <span className="tile-text">
              <span className="tile-title">{e.title}</span>
              <span className="tile-place">{e.place}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Detail({ id }: { id: string }) {
  const e = byId.get(id)!;
  return (
    <div className="detail">
      <ZoomHero className="detail-hero" live={config.heroLive ?? true}>
        <Art seed={e.seed} label={`Illustration: ${e.title}`} />
      </ZoomHero>
      <Body entry={e} />
    </div>
  );
}

/**
 * Hero is a real <img> that arrives late the first time (a slow network). Like a real
 * loading image, it has no size until it arrives. Odd-numbered cards don't reserve
 * space for it; even-numbered ones do (CSS aspect-ratio), which is the usual fix.
 */
const loadedOnce = new Set<string>();
const reservesSpace = (e: Entry) => e.seed % 2 === 1;
function SlowImage({ e }: { e: Entry }) {
  const [src, setSrc] = useState<string | undefined>(loadedOnce.has(e.id) ? artDataUri(e.seed) : undefined);
  useEffect(() => {
    if (src) return;
    const t = setTimeout(() => {
      loadedOnce.add(e.id);
      setSrc(artDataUri(e.seed));
    }, 900 / (config.timeScale ?? 1));
    return () => clearTimeout(t);
  }, [src, e]);
  if (config.lateUrl) return <img className="late-img" src={`${config.lateUrl}/${e.seed}.svg`} alt={`Photo: ${e.title}`} />;
  // While "downloading", render as a browser does for an image that hasn't arrived: no box at all.
  return src ? <img className="late-img" src={src} alt={`Photo: ${e.title}`} /> : <img className="late-img" alt="" />;
}
function LateDetail({ id }: { id: string }) {
  const e = byId.get(id)!;
  return (
    <div className="detail">
      <ZoomHero className={reservesSpace(e) ? "detail-hero-late reserved" : "detail-hero-late"}>
        <SlowImage e={e} />
      </ZoomHero>
      <Body entry={e} long={false} />
    </div>
  );
}

/* ---------------------------------------------------------------- portfolio (matches the reference index) */

const PROJECTS: [string, string][] = [
  ["Title", "continuation as a sentence"],
  ["Another project", "that offers concise help"],
  ["Wayfinding", "for a hospital that nobody gets lost in"],
  ["Type scale", "tuned for low-vision reading"],
  ["Checkout", "that works with a switch device"],
  ["Field guide", "to writing accessible alt text"],
];
function PortfolioIndex({ items }: { items: Entry[] }) {
  const { open } = useZoom();
  return (
    <ul className="pf-grid">
      {items.map((e, i) => (
        <li key={e.id}>
          <a
            className="pf-item"
            data-tile={e.id}
            href={`#/work/${e.id}`}
            onClick={(ev) => {
              if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0) return;
              ev.preventDefault();
              open(e.id);
            }}
          >
            <ZoomSource id={e.id} group="portfolio" as="span" className="pf-thumb">
              <Art seed={e.seed} />
            </ZoomSource>
            <span className="pf-caption">
              <span className="pf-title">{PROJECTS[i][0]}</span> {PROJECTS[i][1]}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
function PortfolioDetail({ id }: { id: string }) {
  const e = byId.get(id)!;
  const i = Number(id.split("-")[1]) - 1;
  return (
    <div className="pf-detail">
      <ZoomHero className="pf-hero">
        <Art seed={e.seed} label={`Project image: ${PROJECTS[i][0]}`} />
      </ZoomHero>
      <div className="pf-body">
        <h2>
          {PROJECTS[i][0]} <span>{PROJECTS[i][1]}</span>
        </h2>
        <Body entry={e} />
      </div>
    </div>
  );
}

function KeyboardDetail({ id }: { id: string }) {
  const e = byId.get(id)!;
  return (
    <div className="detail">
      <ZoomHero className="detail-hero">
        <Art seed={e.seed} label={`Illustration: ${e.title}`} />
      </ZoomHero>
      <div className="detail-body">
        <p className="detail-place">{e.place}</p>
        <h2 className="detail-title">{e.title}</h2>
        <label className="note">
          Leave a note (try the ← → arrow keys and Esc in here)
          <input type="text" defaultValue="Arrow keys should move this cursor" />
        </label>
        <p>
          <a href="#more" onClick={(ev) => ev.preventDefault()}>A link inside the card</a>
        </p>
      </div>
      <Body entry={e} long={false} />
    </div>
  );
}

/* ---------------------------------------------------------------- status bar */

function StatusBar({ extra }: { extra?: ReactNode }) {
  const [s, setS] = useState({ phase: "idle", clones: 0, hidden: 0, locked: false, inertCards: 0 });
  useEffect(() => {
    const id = setInterval(() => {
      const root = document.querySelector<HTMLElement>(".zoom-root");
      setS({
        phase: root?.dataset.phase ?? "idle",
        clones: document.querySelectorAll(".zoom-clone").length,
        hidden: document.querySelectorAll("[data-zoom-hidden]").length,
        locked: document.documentElement.style.overflow === "hidden",
        inertCards: 0,
      });
    }, 100);
    return () => clearInterval(id);
  }, []);
  const reduced = config.simulatedReduced || matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clean = s.phase === "idle" && s.clones === 0 && s.hidden === 0 && !s.locked;
  return (
    <div className="status" aria-hidden="true">
      <span>
        state: <b>{s.phase}</b>
      </span>
      <span>flying copies: {s.clones}</span>
      <span>hidden page items: {s.hidden}</span>
      <span>page scroll: {s.locked ? "locked" : "free"}</span>
      <span className={clean ? "ok" : s.phase === "idle" ? "bad" : ""}>{s.phase === "idle" ? (clean ? "clean ✓" : "leftovers ✗") : "…"}</span>
      <span>reduced motion: {reduced ? (config.simulatedReduced ? "ON (simulated)" : "ON (your OS)") : "off"}</span>
      {extra}
    </div>
  );
}

/* ---------------------------------------------------------------- rapid-fire tester */

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** A click where a real one would land: whatever is on top at the tile's centre. */
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
function centre(id: string) {
  const thumb = document.querySelector(`[data-tile="${id}"] .thumb`)!;
  // Bring an off-screen card into view first (only possible while nothing is open; scrolling is locked then).
  if (!document.querySelector(".zoom-root[data-open]")) thumb.scrollIntoView({ block: "nearest" });
  const r = thumb.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2] as const;
}
const clickTile = (id: string) => clickAt(...centre(id));
const esc = () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
const arrow = (k: "ArrowLeft" | "ArrowRight") => window.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));

function Tester({ items }: { items: Entry[] }) {
  const [log, setLog] = useState("Pick a test. Each one runs by itself; watch the cards and the status bar.");
  const ts = () => config.timeScale ?? 1;
  const run = (name: string, fn: () => Promise<void>) => async () => {
    setLog(`Running: ${name}…`);
    await fn();
    await wait(2500 / ts());
    const root = document.querySelector<HTMLElement>(".zoom-root");
    const clean =
      (root?.dataset.phase ?? "idle") === "idle" &&
      !document.querySelector(".zoom-clone") &&
      !document.querySelector("[data-zoom-hidden]") &&
      document.documentElement.style.overflow !== "hidden";
    const open = root?.dataset.phase === "open";
    setLog(`${name}: finished. ${open ? "A card is open (expected for some tests); press Esc to close it." : clean ? "Page is back to normal ✓" : "Something was left behind ✗"}`);
  };
  const ids = items.map((e) => e.id);
  const t = (ms: number) => wait(ms / ts());
  const tests: [string, () => Promise<void>][] = [
    ["Double-click a card", async () => { clickTile(ids[1]); await t(140); clickTile(ids[1]); }],
    ["Click 8 times fast (two cards)", async () => { for (let i = 0; i < 8; i++) { clickTile(ids[i % 2]); await t(70); } }],
    ["Open, then Esc halfway", async () => { clickTile(ids[2]); await t(220); esc(); }],
    ["Open, then browser Back halfway", async () => { clickTile(ids[3]); await t(220); if (location.hash) history.back(); }],
    ["Close, then tap the card as it flies home", async () => {
      clickTile(ids[4]); await t(900); esc(); await t(90); clickTile(ids[4]);
    }],
    ["Open, then arrow keys quickly", async () => { clickTile(ids[0]); await t(150); for (let i = 0; i < 4; i++) { arrow("ArrowRight"); await t(60); } await t(600); esc(); }],
    ["Chaos: 25 random actions", async () => {
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 25; i++) {
        const r = rnd();
        if (r < 0.45) clickTile(ids[Math.floor(rnd() * ids.length)]);
        else if (r < 0.6) esc();
        else if (r < 0.7) { if (location.hash) history.back(); } // only Back out of the zoom, never off the page
        else if (r < 0.85) arrow(rnd() < 0.5 ? "ArrowLeft" : "ArrowRight");
        else clickAt(innerWidth / 2, 12);
        await t(40 + rnd() * 160);
      }
      await t(800);
      esc();
    }],
  ];
  return (
    <section className="tester">
      <div className="tester-buttons">
        {tests.map(([name, fn]) => (
          <button key={name} type="button" onClick={run(name, fn)}>
            {name}
          </button>
        ))}
      </div>
      <p className="tester-log" role="status">{log}</p>
    </section>
  );
}

/* ---------------------------------------------------------------- scenarios */

function Header({ sticky = false, children }: { sticky?: boolean; children?: ReactNode }) {
  return (
    <header className={sticky ? "site-header sticky" : "site-header"}>
      <span className="logo">Field Notes</span>
      <nav>
        <a href="#x" onClick={(e) => e.preventDefault()}>Journal</a>
        <a href="#x" onClick={(e) => e.preventDefault()}>Places</a>
        <a href="#x" onClick={(e) => e.preventDefault()}>About</a>
      </nav>
      {children}
    </header>
  );
}

const filler = (n: number) =>
  Array.from({ length: n }, (_, i) => (
    <p key={i}>
      Some ordinary page text so the page is long enough to scroll. This is paragraph {i + 1} of the introduction; keep
      scrolling down to reach the cards. Real pages put articles, navigation and footers around the things that zoom.
    </p>
  ));

function App() {
  const [timeScale, setTimeScale] = useState(config.timeScale ?? 1);
  const [closeTiming, setCloseTiming] = useState(config.closeTiming ?? "after");
  useEffect(() => {
    window.__zoomDemo = { setTimeScale: (v) => { config.timeScale = v; setTimeScale(v); } };
    const onMsg = (e: MessageEvent) => {
      if (e.data && e.data.type === "zoom-demo-timescale") window.__zoomDemo!.setTimeScale(e.data.value);
      if (e.data && e.data.type === "zoom-demo-close-timing") setCloseTiming(e.data.value);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const s = config.scenario;
  const base: Partial<ZoomProviderProps> = { timeScale, closeButtonTiming: closeTiming, getLabel: (id) => byId.get(id)?.title ?? id };
  const provider = (render: (id: string) => ReactNode, extra: Partial<ZoomProviderProps> = {}) => ({
    ...base,
    renderDestination: render,
    ...extra,
    ...config.props,
  });
  const detail = (id: string) => <Detail id={id} />;

  if (s === "portfolio") {
    const items = list(s, 6);
    return (
      <ZoomProvider {...provider((id) => <PortfolioDetail id={id} />, { getLabel: (id) => PROJECTS[Number(id.split("-")[1]) - 1][0] })}>
        <main className="pf-page">
          <header className="pf-header">
            <h1>Evan Dunkel</h1>
            <p>Design engineer for accessibility.</p>
          </header>
          <PortfolioIndex items={items} />
        </main>
        <StatusBar />
      </ZoomProvider>
    );
  }
  if (s === "grid" || s === "reduced") {
    const items = list(s, 9);
    return (
      <ZoomProvider {...provider(detail)}>
        <Header />
        <main className="page">
          <h1>Places we walked this year</h1>
          <p className="lede">Click any card to open its story. Use ← → to move between stories, Esc to close.</p>
          <Tiles items={items} group={s} />
        </main>
        <StatusBar />
      </ZoomProvider>
    );
  }
  if (s === "scrolled") {
    const items = list(s, 6);
    return (
      <ZoomProvider {...provider(detail)}>
        <Header sticky />
        <main className="page">
          <h1>A long page</h1>
          {filler(9)}
          <h2 id="featured">Featured walks</h2>
          <Tiles items={items} group={s} />
          {filler(6)}
        </main>
        <StatusBar />
      </ZoomProvider>
    );
  }
  if (s === "mobile") {
    const items = list(s, 8);
    return (
      <ZoomProvider {...provider(detail)}>
        <Header sticky />
        <main className="page page-narrow">
          <h1>Walks</h1>
          <Tiles items={items} group={s} variant="row" />
        </main>
        <StatusBar />
      </ZoomProvider>
    );
  }
  if (s === "rapid") {
    const items = list(s, 6);
    return (
      <ZoomProvider {...provider(detail, { history: { mode: "session" } })}>
        <Header />
        <main className="page">
          <Tester items={items} />
          <Tiles items={items} group={s} />
        </main>
        <StatusBar />
      </ZoomProvider>
    );
  }
  if (s === "late") {
    const items = list(s, 6).map((e) => ({ ...e, place: reservesSpace(e) ? "Photo space reserved" : "Photo space NOT reserved" }));
    items.forEach((x) => byId.set(x.id, x));
    return (
      <ZoomProvider {...provider((id) => <LateDetail id={id} />)}>
        <Header />
        <main className="page">
          <h1>Photos that arrive late</h1>
          <p className="lede">
            Each card’s big photo takes about a second to “download” the first time it opens. Cards whose page reserves
            space for the photo cope; cards that don’t, break the page. Use “Reload stage” to recover.
          </p>
          <Tiles items={items} group={s} />
        </main>
        <StatusBar />
      </ZoomProvider>
    );
  }
  if (s === "carousel") {
    const items = list(s, 10);
    return (
      <ZoomProvider {...provider(detail)}>
        <Header />
        <main className="page">
          <h1>A sideways-scrolling row</h1>
          <p className="lede">The last visible card is cut off by the edge of the row.</p>
          <Tiles items={items} group={s} variant="carousel" />
          {filler(2)}
        </main>
        <StatusBar />
      </ZoomProvider>
    );
  }
  if (s === "template") {
    // Plain-HTML sources + <template> destinations (the "Astro" path: scan + TemplateDestination).
    return (
      <ZoomProvider {...provider((id) => <TemplateDestination id={id} />, { scan: true })}>
        <StatusBar />
      </ZoomProvider>
    );
  }
  // keyboard
  const items = list(s, 6);
  return (
    <ZoomProvider {...provider((id) => <KeyboardDetail id={id} />)}>
      <Header />
      <main className="page">
        <h1>Keyboard and screen reader</h1>
        <p className="lede">
          Click here first, then use only the keyboard: <kbd>Tab</kbd> to a card, <kbd>Enter</kbd> to open it.
        </p>
        <Tiles items={items} group={s} />
        <p>
          <a href="#after" onClick={(e) => e.preventDefault()}>A link on the page, after the cards</a>
        </p>
      </main>
      <StatusBar />
    </ZoomProvider>
  );
}

createRoot(document.getElementById("app")!).render(<App />);
