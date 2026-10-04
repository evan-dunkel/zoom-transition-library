import { animate, type MotionValue } from "motion/react";

/** A spring described the way SwiftUI does: perceived duration in seconds, and bounce (0 = none). */
export type SpringSpec = { duration: number; bounce: number };

export type ZoomTiming = {
  /** Card zooming up from the source. */
  open: SpringSpec;
  /** Cards shrinking back into their sources. */
  close: SpringSpec;
  /** Settling onto a page after a swipe or arrow key. */
  page: SpringSpec;
  /** Snapping back when a dismiss drag is let go early. */
  cancel: SpringSpec;
  /** Fades: a card with no source to return to, and the group's dimming swapping over while open. */
  fade: SpringSpec;
  /** Unused since reduced motion became instant (no fade). Kept so existing timing props still type-check. */
  fadeOut: SpringSpec;
};

export const defaultTiming: ZoomTiming = {
  open: { duration: 0.5, bounce: 0.15 },
  close: { duration: 0.5 / 1.75, bounce: 0.15 }, // 1.75× faster than open
  page: { duration: 0.5, bounce: 0 }, // SwiftUI .smooth
  cancel: { duration: 0.5, bounce: 0.15 },
  fade: { duration: 0.35, bounce: 0 },
  fadeOut: { duration: 0.35 / 1.75, bounce: 0 },
};

const TAU = Math.PI * 2;

/**
 * SwiftUI's Spring(duration:bounce:) as physical parameters (mass 1).
 * Motion's own `duration` option means total settle time, which is a different
 * curve, so we hand Motion stiffness and damping directly for exact parity.
 */
export function springPhysics({ duration, bounce }: SpringSpec) {
  const stiffness = (TAU / duration) ** 2;
  const damping =
    bounce >= 0 ? (4 * Math.PI * (1 - bounce)) / duration : (4 * Math.PI) / (duration * (1 + bounce));
  return { stiffness, damping, mass: 1 };
}

/** Rest thresholds: how close counts as "arrived". Pixels vs. scale need different units. */
export const REST = {
  px: 0.25,
  scale: 0.0008,
  landPx: 0.5, // closing lands within half a pixel: the sub-pixel creep is invisible but long
  landScale: 0.0015,
  opacity: 0.002,
};

/** The latest springTo per value, so a stale safety timer never overrides a newer animation. */
const latestSpring = new WeakMap<MotionValue<number>, object>();

export function springTo(
  value: MotionValue<number>,
  to: number,
  spec: SpringSpec,
  opts: { velocity?: number; restDelta?: number; speed?: number } = {},
): Promise<void> {
  // A spring to or from a value that isn't a real number never settles, which used to
  // leave a transition hanging forever (and the page locked). Land at once instead.
  if (!Number.isFinite(to)) return Promise.resolve();
  if (!Number.isFinite(value.get())) {
    value.jump(to);
    return Promise.resolve();
  }
  const restDelta = opts.restDelta ?? REST.px;
  const velocity = opts.velocity !== undefined && Number.isFinite(opts.velocity) ? opts.velocity : undefined;
  const controls = animate(value, to, {
    type: "spring",
    ...springPhysics(spec),
    restDelta,
    restSpeed: restDelta * 12,
    ...(velocity === undefined ? {} : { velocity }),
  });
  const speed = opts.speed ?? 1;
  if (speed !== 1) controls.speed = speed;
  const token = {};
  latestSpring.set(value, token);
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve();
    };
    // Safety net: a spring still moving long after it should have settled is finished by
    // hand, so no transition can hang. Well beyond any real settle time, even in slow motion.
    const limit = ((spec.duration * 6) / Math.max(speed, 0.01) + 1) * 1000;
    const timer = setTimeout(() => {
      if (latestSpring.get(value) === token) {
        controls.stop();
        value.jump(to);
      }
      finish();
    }, limit);
    controls.then(finish);
  });
}

/** UIScrollView's rubber-band curve (constant 0.55). */
export const rubber = (offset: number, dimension: number) =>
  (1 - 1 / ((offset * 0.55) / dimension + 1)) * dimension;

/** Where a flick would come to rest under UIScrollView's normal deceleration (0.998). */
export const project = (velocity: number, rate = 0.998) => (velocity / 1000) * (rate / (1 - rate));

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
