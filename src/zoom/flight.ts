import { cancelFrame, frame, motionValue, type MotionValue } from "motion/react";
import { clamp } from "./springs";

/** Corner radii in px, clockwise from top-left (as in CSS): top-left, top-right, bottom-right, bottom-left. */
export type Corners = [number, number, number, number];

/** A box on screen. r: its corner radii on screen (px); left out, the hero's own radii are used. */
export type Rect = { x: number; y: number; w: number; h: number; r?: number | Corners };

type Fit = { s: number; cx: number; cy: number; ix: number; iy: number; r: Corners };

const corners = (r: number | Corners): Corners => (typeof r === "number" ? [r, r, r, r] : r);

export type Flight = {
  cx: MotionValue<number>;
  cy: MotionValue<number>;
  s: MotionValue<number>;
  /** Where the flight ends, in the same units as cx/cy/s. */
  to: Fit;
  /** For live heroes: the element the hero's React content renders into. */
  liveHost: HTMLElement | null;
  /** Remove the still snapshot once the live content has rendered over it. */
  dropSnapshot(): void;
  /** Point the flight somewhere new from wherever it is now (its springs keep their speed). */
  retarget(next: Rect): void;
  /** Re-apply the extra offset (e.g. after the card's content scrolled). */
  invalidate(): void;
  destroy(): void;
};

export type HeroMetrics = {
  W0: number;
  H0: number;
  /** The hero's own corner radii (its first child's, if it has none). */
  radius: Corners;
  /** The hero's own box-shadow ("none" if it has none) and corner radius, for the flight's shadow layer. */
  shadow: string;
  shadowRadius: string;
};

/** Far enough outside the copy's box that nothing a hero paints reaches it. */
const OUTSIDE = 10000;

/** Read everything a flight needs from the hero, in one go, before anything is written. */
export function measureHero(hero: HTMLElement): HeroMetrics {
  const cs = getComputedStyle(hero);
  return { W0: hero.offsetWidth, H0: hero.offsetHeight, radius: readCorners(hero), shadow: cs.boxShadow, shadowRadius: cs.borderRadius };
}

/**
 * A hero with no size yet (typically an image still downloading, with no width/height
 * or aspect-ratio to reserve its space) can't be flown: there is nothing to scale.
 */
export const canFly = (m: HeroMetrics) => m.W0 >= 1 && m.H0 >= 1;

/**
 * The still copy that flies. Live heroes only show it for the frame or so before
 * their real content renders, so a plain clone is enough (their own classes come
 * along). Static heroes fly as this copy the whole way, so their computed styles
 * are frozen onto it: styles that came from where the hero sat in the card would
 * otherwise be lost. Freezing is expensive, so it's cached per hero and can be
 * prepared ahead of time with prepareSnapshot().
 */
const frozenCache = new WeakMap<HTMLElement, { node: HTMLElement; w: number; h: number }>();
export function prepareSnapshot(hero: HTMLElement) {
  const w = hero.offsetWidth;
  const h = hero.offsetHeight;
  const cached = frozenCache.get(hero);
  if (cached && cached.w === w && cached.h === h) return cached.node;
  const node = hero.cloneNode(true) as HTMLElement;
  freezeStyles(hero, node);
  frozenCache.set(hero, { node, w, h });
  return node;
}
export function snapshotOf(hero: HTMLElement, live: boolean) {
  return live ? (hero.cloneNode(true) as HTMLElement) : (prepareSnapshot(hero).cloneNode(true) as HTMLElement);
}

/**
 * A still copy of a source (the thumbnail on the page), styles frozen on, for the
 * flight to dissolve from or into. Not cached: a source can look different each time
 * (hover styles, a newly loaded image).
 */
export function sourceSnapshot(source: HTMLElement) {
  const node = source.cloneNode(true) as HTMLElement;
  // Only what a thumbnail's look depends on: copying every computed property (as for
  // static heroes) cost a noticeable stall at the start of each open on slower phones.
  freezeStyles(source, node, SOURCE_PROPS, 40);
  for (const a of ["data-zoom-hidden", "data-zoom-dimmed", "data-zoom-source", "data-zoom-react-source", "id"]) node.removeAttribute(a);
  node.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
  node.style.visibility = "visible";
  node.style.opacity = "1";
  node.style.margin = "0";
  node.style.position = "absolute";
  node.style.left = "0";
  node.style.top = "0";
  node.style.transformOrigin = "0 0";
  node.style.pointerEvents = "none";
  return { node, w: source.offsetWidth, h: source.offsetHeight };
}

/** How far into the flight (from the source's end) the source has fully dissolved into the hero. */
const DISSOLVE = 0.5;

/**
 * Flies a copy of the destination's hero from one rect to another. The copy is
 * scaled uniformly to *cover* each rect and cropped to it, so a square thumbnail
 * can grow into a wide hero (or any other aspect change) without stretching.
 * Pass metrics and snapshot measured up front to keep this free of layout reads.
 */
export function createFlight(
  layer: HTMLElement,
  hero: HTMLElement,
  from: Rect,
  to: Rect,
  opts: {
    id?: string;
    live?: { className?: string };
    metrics?: HeroMetrics;
    snapshot?: HTMLElement;
    /** Added on top of the spring's position every frame (e.g. to follow content scrolled mid-flight). */
    offset?: () => { x: number; y: number };
    /** A vertical band (in the layer's coordinates) to clip the copy to, or null for none. */
    clip?: () => { top: number; bottom: number } | null;
    /**
     * How much of the hero's own shadow to show (0 to 1), read every frame. The
     * source it flies from usually has none, so a shadow carried at full strength
     * pops on at take-off and off at landing; this fades it with the flight instead.
     */
    shadowOpacity?: () => number;
    /**
     * The source end of the flight: a copy of the thumbnail (sourceSnapshot) and its
     * box. Near that end the copy is shown over the hero, dissolving into it over the
     * first part of the flight, so a thumbnail cropped differently from the hero (or a
     * different image altogether) doesn't jump at take-off or landing.
     */
    source?: { node: HTMLElement; w: number; h: number; rect: Rect };
  } = {},
): Flight {
  const { W0, H0, radius, shadow, shadowRadius } = opts.metrics ?? measureHero(hero);
  const fit = (r: Rect): Fit => {
    const s = Math.max(r.w / W0, r.h / H0, 1e-6);
    return {
      s,
      cx: r.x + r.w / 2,
      cy: r.y + r.h / 2,
      ix: Math.max(0, (W0 - r.w / s) / 2),
      iy: Math.max(0, (H0 - r.h / s) / 2),
      // On screen, so the corners can blend from the source's radii to the hero's.
      r: r.r !== undefined ? corners(r.r) : (radius.map((v) => v * s) as Corners),
    };
  };
  let A = fit(from);
  let B = fit(to);

  const el = document.createElement("div");
  el.className = "zoom-clone";
  el.setAttribute("aria-hidden", "true");
  if (opts.id) el.dataset.zoomId = opts.id;
  el.style.width = `${W0}px`;
  el.style.height = `${H0}px`;
  const copy = opts.snapshot ?? snapshotOf(hero, !!opts.live);
  copy.removeAttribute("data-zoom-hero");
  copy.style.visibility = "visible";
  copy.style.margin = "0";
  copy.style.width = `${W0}px`;
  copy.style.height = `${H0}px`;
  // The hero's own shadow is drawn on a layer of its own, behind the copy, so it can fade.
  let shade: HTMLElement | null = null;
  if (shadow && shadow !== "none") {
    shade = document.createElement("div");
    shade.className = "zoom-clone-shadow";
    shade.style.cssText = `position:absolute;inset:0;border-radius:${shadowRadius};box-shadow:${shadow};pointer-events:none;`;
    el.appendChild(shade);
    copy.style.boxShadow = "none";
  }
  el.appendChild(copy);
  // Live heroes get a host for their own React content. Until that content has
  // rendered (usually the same frame), the snapshot underneath stands in.
  let liveHost: HTMLElement | null = null;
  if (opts.live) {
    liveHost = document.createElement("div");
    liveHost.className = ["zoom-live", opts.live.className].filter(Boolean).join(" ");
    liveHost.style.cssText = `position:absolute;left:0;top:0;width:100%;height:100%;margin:0;${shade ? "box-shadow:none;" : ""}`;
    el.appendChild(liveHost);
  }
  // The thumbnail's own look, over everything, dissolving as the flight leaves it.
  const src = opts.source;
  const sSrc = src ? fit(src.rect).s : 1;
  // A source the same size as the hero has nothing to dissolve over; skip it.
  const dissolves = !!src && src.w >= 1 && src.h >= 1 && Math.abs(1 - sSrc) > 0.02;
  if (src && dissolves) el.appendChild(src.node);
  layer.appendChild(el);

  const cx = motionValue(A.cx);
  const cy = motionValue(A.cy);
  const s = motionValue(A.s);

  const crop = (sv: number) => {
    const t = A.s === B.s ? 1 : clamp((sv - A.s) / (B.s - A.s), 0, 1);
    return { ix: A.ix + (B.ix - A.ix) * t, iy: A.iy + (B.iy - A.iy) * t, r: A.r.map((a, i) => a + (B.r[i] - a) * t) as Corners };
  };
  const write = () => {
    scheduled = false;
    const sv = s.get();
    const { ix, iy, r } = crop(sv);
    // The corner radii in the copy's own (unscaled) units.
    const radii = r.map((v) => (v > 0.25 && sv > 0 ? v / sv : 0));
    const round = Math.max(...radii);
    if (src && dissolves) {
      // Cover the visible (cropped) box with the thumbnail copy, and fade it out over the
      // first DISSOLVE of the way from the source's scale to the hero's own (1).
      const vw = W0 - 2 * ix;
      const vh = H0 - 2 * iy;
      const k = Math.max(vw / src.w, vh / src.h);
      src.node.style.transform = `translate(${ix + (vw - src.w * k) / 2}px, ${iy + (vh - src.h * k) / 2}px) scale(${k})`;
      const u = clamp((sv - sSrc) / (1 - sSrc) / DISSOLVE, 0, 1);
      src.node.style.opacity = String(1 - u * u * (3 - 2 * u));
    }
    const o = opts.offset ? opts.offset() : { x: 0, y: 0 };
    const left = cx.get() + o.x - (W0 * sv) / 2;
    const top = cy.get() + o.y - (H0 * sv) / 2;
    el.style.transform = `translate(${left}px, ${top}px) scale(${sv})`;
    if (shade) shade.style.opacity = String(clamp(opts.shadowOpacity ? opts.shadowOpacity() : 1, 0, 1));
    // Clip only the sides that are meant to be clipped. A clip-path also cuts
    // anything the hero paints outside its own box (a shadow, a cover swung open
    // in 3D, a glow), so every side that isn't being cropped is pushed far out
    // (negative inset) instead of sitting on the box edge.
    // Rounded corners have to sit on the box's edges, so rounding clips every side.
    const cropX = ix > 0.5 || round > 0;
    const cropY = iy > 0.5 || round > 0;
    let it = cropY ? iy : -OUTSIDE;
    let ib = cropY ? iy : -OUTSIDE;
    const band = opts.clip ? opts.clip() : null;
    if (band && sv > 0) {
      it = Math.max(it, (band.top - top) / sv);
      ib = Math.max(ib, (top + H0 * sv - band.bottom) / sv);
    }
    const ixs = cropX ? ix : -OUTSIDE;
    el.style.clipPath =
      cropX || it > -OUTSIDE || ib > -OUTSIDE
        ? `inset(${it}px ${ixs}px ${ib}px ${ixs}px${round > 0 ? ` round ${radii.map((v) => `${v}px`).join(" ")}` : ""})`
        : "";
  };
  // Three values change each frame; write the style once, in Motion's render step.
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    frame.render(write);
  };
  const unsubscribe = [cx, cy, s].map((v) => v.on("change", schedule));
  write();

  const flight: Flight = {
    cx,
    cy,
    s,
    to: B,
    liveHost,
    dropSnapshot() {
      copy.remove();
    },
    invalidate: () => schedule(),
    retarget(next) {
      const sv = s.get();
      A = { s: sv, cx: cx.get(), cy: cy.get(), ...crop(sv) };
      B = fit(next);
      flight.to = B;
    },
    destroy() {
      unsubscribe.forEach((u) => u());
      cancelFrame(write);
      [cx, cy, s].forEach((v) => v.stop());
      el.remove();
    },
  };
  return flight;
}

/** An element's corner radii in px: its own, or (if it has none) its first child's, e.g. a rounded <img>. */
export function readCorners(el: HTMLElement): Corners {
  const own = cornersOf(el);
  if (own.some((v) => v > 0)) return own;
  const child = el.firstElementChild as HTMLElement | null;
  return child ? cornersOf(child) : own;
}
function cornersOf(el: HTMLElement): Corners {
  const cs = getComputedStyle(el);
  const px = (value: string) => {
    const v = value.split(" ")[0];
    return v.endsWith("%") ? (parseFloat(v) / 100) * Math.min(el.offsetWidth, el.offsetHeight) : parseFloat(v) || 0;
  };
  return [px(cs.borderTopLeftRadius), px(cs.borderTopRightRadius), px(cs.borderBottomRightRadius), px(cs.borderBottomLeftRadius)];
}

/** The properties a thumbnail's appearance comes from (SVG shapes keep their own attributes). */
const SOURCE_PROPS = [
  "display", "box-sizing", "width", "height", "padding", "border", "border-radius", "overflow",
  "background-color", "background-image", "background-size", "background-position", "background-repeat",
  "color", "font", "line-height", "letter-spacing", "text-align", "white-space",
  "object-fit", "object-position", "opacity", "filter", "box-shadow", "transform", "transform-origin",
  "position", "top", "left", "right", "bottom", "margin", "flex", "align-items", "justify-content", "gap",
  "grid-template-columns", "grid-template-rows", "aspect-ratio", "fill", "stroke", "mix-blend-mode",
];

const MAX_FROZEN = 300;
function freezeStyles(source: Element, target: Element, props?: string[], max = MAX_FROZEN) {
  const from = [source, ...source.querySelectorAll("*")];
  const to = [target, ...target.querySelectorAll("*")];
  const n = Math.min(from.length, to.length, max);
  for (let i = 0; i < n; i++) {
    const cs = getComputedStyle(from[i]);
    let text = "";
    if (props) {
      for (const prop of props) text += `${prop}:${cs.getPropertyValue(prop)};`;
    } else {
      for (let j = 0; j < cs.length; j++) {
        const prop = cs[j];
        if (prop === "visibility" || prop.startsWith("transition") || prop.startsWith("animation")) continue;
        text += `${prop}:${cs.getPropertyValue(prop)};`;
      }
    }
    (to[i] as HTMLElement).style.cssText = text;
  }
}
