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
  /** What the copy shows right now: its visible box and corner radii, in the layer's coordinates (px). */
  visible(): { x: number; y: number; w: number; h: number; r: Corners };
  destroy(): void;
};

export type HeroMetrics = {
  W0: number;
  H0: number;
  /**
   * When the hero is just one image (an <img>, <video> or SVG filling its box, cropped
   * to fit like object-fit: cover), the box that shows the *whole* picture: the hero's
   * box widened or heightened to the picture's own shape. The flight carries that whole
   * picture and crops it, so the crop changes smoothly from the thumbnail's to the
   * hero's instead of starting from a crop of a crop.
   */
  fill: { W: number; H: number } | null;
  /** The hero's own corner radii (its first child's, if it has none). */
  radius: Corners;
  /** The hero's own box-shadow ("none" if it has none) and corner radius, for the flight's shadow layer. */
  shadow: string;
  shadowRadius: string;
};

/** Far enough outside the copy's box that nothing a hero paints reaches it. */
const OUTSIDE = 10000;

/**
 * Read everything a flight needs from the hero, in one go, before anything is written.
 * standInAspect: the shape of the source's picture, used while the hero's own image is still
 * downloading (its shape isn't known yet, and the source's picture flies in its place).
 */
export function measureHero(hero: HTMLElement, standInAspect: number | null = null): HeroMetrics {
  const cs = getComputedStyle(hero);
  const W0 = hero.offsetWidth;
  const H0 = hero.offsetHeight;
  const a = mediaAspect(hero, standInAspect);
  const fill = a && W0 >= 1 && H0 >= 1 && Math.abs(a - W0 / H0) > 0.01 ? (a > W0 / H0 ? { W: H0 * a, H: H0 } : { W: W0, H: W0 / a }) : null;
  return { W0, H0, fill, radius: readCorners(hero), shadow: cs.boxShadow, shadowRadius: cs.borderRadius };
}

/** The one image a hero consists of, or null if it has anything else (text, several images). */
function heroMedia(hero: HTMLElement) {
  if (hero.textContent?.trim()) return null;
  const media = [...hero.querySelectorAll<HTMLElement | SVGSVGElement>("img, video, svg, canvas")].filter(
    (m) => !m.parentElement?.closest("svg"),
  );
  return media.length === 1 ? media[0] : null;
}
/** The shape (width / height) of a hero's whole picture, when it's a single image cropped to cover its box. */
function mediaAspect(hero: HTMLElement, standInAspect: number | null): number | null {
  const m = heroMedia(hero);
  if (!m) return null;
  if (m instanceof HTMLImageElement || m instanceof HTMLVideoElement) {
    const w = m instanceof HTMLImageElement ? m.naturalWidth : m.videoWidth;
    const h = m instanceof HTMLImageElement ? m.naturalHeight : m.videoHeight;
    if (getComputedStyle(m).objectFit !== "cover") return null;
    return w && h ? w / h : standInAspect;
  }
  if (m instanceof SVGSVGElement) {
    const vb = m.viewBox.baseVal;
    return vb && vb.width && vb.height && m.preserveAspectRatio.baseVal.meetOrSlice === SVGPreserveAspectRatio.SVG_MEETORSLICE_SLICE
      ? vb.width / vb.height
      : null;
  }
  return null;
}

/** An image that has arrived and can be drawn. */
const loaded = (img: HTMLImageElement) => img.complete && img.naturalWidth > 0;

/** The hero's single image, if it hasn't downloaded yet. */
function pendingImage(hero: HTMLElement) {
  const m = heroMedia(hero);
  return m instanceof HTMLImageElement && !loaded(m) ? m : null;
}

/**
 * The picture a source shows, when it's a single image that has arrived: its address and shape.
 * It stands in for a hero image that is still downloading (the detail photo is usually a
 * different, bigger file that only starts loading when the card opens), so the picture that
 * flies is the one the visitor tapped rather than an empty box.
 */
export function sourcePicture(el: HTMLElement): { src: string; aspect: number } | null {
  const m = heroMedia(el);
  if (m instanceof HTMLImageElement) {
    return loaded(m) ? { src: m.currentSrc || m.src, aspect: m.naturalWidth / m.naturalHeight } : null;
  }
  if (m instanceof SVGSVGElement) {
    const vb = m.viewBox.baseVal;
    const w = vb?.width || m.width.baseVal.value;
    const h = vb?.height || m.height.baseVal.value;
    if (!w || !h) return null;
    const svg = new XMLSerializer().serializeToString(m);
    return { src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, aspect: w / h };
  }
  return null;
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
const frozenCache = new WeakMap<HTMLElement, { node: HTMLElement; w: number; h: number; srcs: string }>();
export function prepareSnapshot(hero: HTMLElement) {
  const w = hero.offsetWidth;
  const h = hero.offsetHeight;
  // An image that changed (or arrived) since the copy was made makes it stale.
  const srcs = Array.from(hero.querySelectorAll("img"), (i) => i.currentSrc || i.src).join("|");
  const cached = frozenCache.get(hero);
  if (cached && cached.w === w && cached.h === h && cached.srcs === srcs) return cached.node;
  const node = hero.cloneNode(true) as HTMLElement;
  freezeStyles(hero, node);
  frozenCache.set(hero, { node, w, h, srcs });
  return node;
}
export function snapshotOf(hero: HTMLElement, live: boolean) {
  return live ? (hero.cloneNode(true) as HTMLElement) : (prepareSnapshot(hero).cloneNode(true) as HTMLElement);
}

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
    /** The source's picture, flown in place of a hero image that hasn't downloaded yet. */
    standIn?: { src: string } | null;
  } = {},
): Flight {
  const m = opts.metrics ?? measureHero(hero);
  const { radius, shadow, shadowRadius } = m;
  // The flying box: the whole picture when the hero is a single image, else the hero's own box.
  const W0 = m.fill ? m.fill.W : m.W0;
  const H0 = m.fill ? m.fill.H : m.H0;
  const fit = (r: Rect): Fit => {
    const s = Math.max(r.w / W0, r.h / H0, 1e-6);
    return {
      s,
      cx: r.x + r.w / 2,
      cy: r.y + r.h / 2,
      ix: Math.max(0, (W0 - r.w / s) / 2),
      iy: Math.max(0, (H0 - r.h / s) / 2),
      // On screen, so the corners can blend from the source's radii to the hero's.
      r: r.r !== undefined ? corners(r.r) : (radius.map((v) => v * Math.max(r.w / m.W0, r.h / m.H0)) as Corners),
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
  // The hero's image is still downloading: the copy shows the source's picture instead, and
  // switches to the hero's own once it arrives.
  const pending = pendingImage(hero);
  const copyImg = pending ? heroMedia(copy) : null;
  let offPending = () => {};
  if (pending && copyImg instanceof HTMLImageElement) {
    if (opts.standIn) {
      copyImg.removeAttribute("srcset");
      copyImg.removeAttribute("sizes");
      copyImg.src = opts.standIn.src;
    }
    const arrived = () => {
      if (!loaded(pending)) return;
      copyImg.removeAttribute("srcset");
      copyImg.src = pending.currentSrc || pending.src;
    };
    pending.addEventListener("load", arrived);
    offPending = () => pending.removeEventListener("load", arrived);
  }
  // Live heroes get a host for their own React content. Until that content has
  // rendered (usually the same frame), the snapshot underneath stands in.
  let liveHost: HTMLElement | null = null;
  if (opts.live) {
    liveHost = document.createElement("div");
    liveHost.className = ["zoom-live", opts.live.className].filter(Boolean).join(" ");
    liveHost.style.cssText = `position:absolute;left:0;top:0;width:100%;height:100%;margin:0;${shade ? "box-shadow:none;" : ""}`;
    el.appendChild(liveHost);
  }
  if (m.fill) {
    // The whole picture fills the flying box (it was cropped to the hero's box before).
    el.dataset.zoomFill = "";
    const media = heroMedia(copy);
    for (let n: Element | null = media; n && n !== copy; n = n.parentElement) {
      (n as HTMLElement).style.width = "100%";
      (n as HTMLElement).style.height = "100%";
    }
  }
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
  let offLive = () => {};
  write();

  const flight: Flight = {
    cx,
    cy,
    s,
    to: B,
    liveHost,
    dropSnapshot() {
      // The live content's image may still be downloading: keep the copy (showing the source's
      // picture) in front until it has arrived, rather than flying an empty box.
      const live = liveHost && heroMedia(liveHost);
      if (!(live instanceof HTMLImageElement) || loaded(live)) {
        copy.remove();
        return;
      }
      const host = liveHost!;
      host.style.visibility = "hidden";
      const check = () => {
        const img = heroMedia(host);
        if (img instanceof HTMLImageElement && !loaded(img)) return;
        host.style.visibility = "";
        copy.remove();
        offLive();
      };
      host.addEventListener("load", check, true); // load doesn't bubble, but capturing sees it
      offLive = () => host.removeEventListener("load", check, true);
    },
    invalidate: () => schedule(),
    visible() {
      const sv = s.get();
      const { ix, iy, r } = crop(sv);
      const o = opts.offset ? opts.offset() : { x: 0, y: 0 };
      return {
        x: cx.get() + o.x - (W0 * sv) / 2 + ix * sv,
        y: cy.get() + o.y - (H0 * sv) / 2 + iy * sv,
        w: (W0 - 2 * ix) * sv,
        h: (H0 - 2 * iy) * sv,
        r,
      };
    },
    retarget(next) {
      const sv = s.get();
      A = { s: sv, cx: cx.get(), cy: cy.get(), ...crop(sv) };
      B = fit(next);
      flight.to = B;
    },
    destroy() {
      offPending();
      offLive();
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

const MAX_FROZEN = 300;
function freezeStyles(source: Element, target: Element) {
  const from = [source, ...source.querySelectorAll("*")];
  const to = [target, ...target.querySelectorAll("*")];
  const n = Math.min(from.length, to.length, MAX_FROZEN);
  for (let i = 0; i < n; i++) {
    const cs = getComputedStyle(from[i]);
    let text = "";
    for (let j = 0; j < cs.length; j++) {
      const prop = cs[j];
      if (prop === "visibility" || prop.startsWith("transition") || prop.startsWith("animation")) continue;
      text += `${prop}:${cs.getPropertyValue(prop)};`;
    }
    (to[i] as HTMLElement).style.cssText = text;
  }
}
