import { useId } from "react";

// Demo content: deterministic "landscape" artwork drawn as inline SVG (so the demo
// works offline with no image files) and some field-notes text for detail pages.

export type Entry = { id: string; title: string; place: string; seed: number };

const TITLES: [string, string][] = [
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

export const entries = (prefix: string, n = 9): Entry[] =>
  TITLES.slice(0, n).map(([title, place], i) => ({ id: `${prefix}-${i + 1}`, title, place, seed: i }));

const PALETTES = [
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

function artParts(seed: number) {
  const p = PALETTES[seed % PALETTES.length];
  const r = (k: number) => (Math.sin(seed * 97.13 + k * 13.7) + 1) / 2;
  const ridge = (base: number, amp: number, k: number) => {
    let d = `M0 300 L0 ${base}`;
    for (let x = 0; x <= 400; x += 40) d += ` L${x} ${(base - amp * r(k + x / 40)).toFixed(1)}`;
    return d + " L400 300 Z";
  };
  return {
    p,
    sun: { cx: 80 + 240 * r(1), cy: 70 + 40 * r(2), r: 26 + 10 * r(3) },
    ridges: [ridge(190, 90, 4), ridge(230, 60, 9), ridge(268, 34, 15)],
  };
}

/** A little landscape. preserveAspectRatio "slice" lets it fill any box shape. */
export function Art({ seed, label }: { seed: number; label?: string }) {
  const { p, sun, ridges } = artParts(seed);
  const gid = `sky${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg className="art" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p[1]} />
          <stop offset="1" stopColor={p[0]} />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill={`url(#${gid})`} />
      <circle cx={sun.cx} cy={sun.cy} r={sun.r} fill="#fff" opacity="0.75" />
      {ridges.map((d, i) => (
        <path key={i} d={d} fill={p[i + 2]} />
      ))}
    </svg>
  );
}

/** The same picture as an image file (a data: URL), 1600x1000, for <img>. */
export function artDataUri(seed: number) {
  const { p, sun, ridges } = artParts(seed);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 25 400 250" preserveAspectRatio="xMidYMid slice">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p[1]}"/><stop offset="1" stop-color="${p[0]}"/></linearGradient></defs>` +
    `<rect width="400" height="300" fill="url(#g)"/><circle cx="${sun.cx}" cy="${sun.cy}" r="${sun.r}" fill="#fff" opacity="0.75"/>` +
    ridges.map((d, i) => `<path d="${d}" fill="${p[i + 2]}"/>`).join("") +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const PARAGRAPHS = [
  "We set out before first light, when the air still held the cold of the night and the only sound was gravel under our boots. The path is easy to lose in the dark, so we followed the line of cairns that earlier walkers had left, one small stack of stones at a time.",
  "By the time the sun cleared the ridge, the whole valley had changed colour. Shadows that had looked like solid rock turned out to be shallow pools, and the far slope, which had seemed close enough to touch, pulled back into the distance where it belonged.",
  "Locals told us the light is best in the hour after sunrise and the hour before sunset; in between, it flattens everything. We spent the middle of the day in the shade, sketching, eating, and arguing about which way the weather would turn.",
  "Coming back down, we took the longer route along the water. It added an hour, but the reflections were worth every step, and we met a shepherd who pointed out a spring we would never have found on our own.",
  "If you go, bring more water than you think you need, a layer for the wind, and patience. The best moments here are slow ones, and they rarely happen on schedule.",
];

export function Body({ entry, long = true }: { entry: Entry; long?: boolean }) {
  const n = long ? PARAGRAPHS.length : 2;
  return (
    <div className="detail-body">
      <p className="detail-place">{entry.place}</p>
      <h2 className="detail-title">{entry.title}</h2>
      {Array.from({ length: n }, (_, i) => (
        <p key={i}>{PARAGRAPHS[(i + entry.seed) % PARAGRAPHS.length]}</p>
      ))}
      {long && (
        <>
          <h3>Getting there</h3>
          <p>{PARAGRAPHS[(entry.seed + 2) % PARAGRAPHS.length]}</p>
          <h3>When to visit</h3>
          <p>{PARAGRAPHS[(entry.seed + 4) % PARAGRAPHS.length]}</p>
        </>
      )}
    </div>
  );
}
