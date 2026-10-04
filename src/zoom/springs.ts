import { animate, type MotionValue } from "motion/react";

/** A spring described the way SwiftUI does: perceived duration in seconds, and bounce (0 = none). */
export type SpringSpec = { duration: number; bounce: number };

export type ZoomTiming = {
  /** Card zooming up from the source. */
  open: SpringSpec;
  /** Cards shrinking back into their sources. */
  close: SpringSpec;
  /** Settling onto a page after a swipe or arrow key. Default 0.25 s, no bounce. */
  page: SpringSpec;
  /** Snapping back when a dismiss drag is let go early. */
  cancel: SpringSpec;
  /** Fades: a card with no source to return to, and the group's dimming swapping over while open. */
  fade: SpringSpec;
};

export const defaultTiming: ZoomTiming = {
  open: { duration: 0.5, bounce: 0.15 },
  close: { duration: 0.5 / 1.75, bounce: 0.15 }, // 1.75× faster than open
  // Short and without bounce: a longer spring spends most of its time creeping the last few pixels.
  page: { duration: 0.25, bounce: 0 },
  cancel: { duration: 0.5, bounce: 0.15 },
  fade: { duration: 0.35, bounce: 0 },
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

/**
 * A value's speed (units per second). Motion's own getVelocity() reads 0 once the value hasn't
 * changed for 30 ms, so a turn-around started by a click just after a slow frame (common on
 * phones) lost every card's speed and they stopped dead. This reads the same two samples Motion
 * keeps, but trusts them for up to 300 ms (a slow phone, or a busy one). A jump() clears them, so a
 * jumped value reads 0, as it
 * should. If Motion ever stops keeping them, its own reading is used.
 */
export function velocityOf(value: MotionValue<number>) {
  const m = value as unknown as { prevFrameValue?: number; prevUpdatedAt?: number; updatedAt?: number };
  if (!("prevFrameValue" in m) || typeof m.updatedAt !== "number") return value.getVelocity();
  if (m.prevFrameValue === undefined || m.prevUpdatedAt === undefined) return 0;
  if (performance.now() - m.updatedAt > 300) return 0; // it has stopped (jump() and settle() clear it at once)
  const dt = m.updatedAt - m.prevUpdatedAt;
  return dt > 0 ? ((value.get() - Number(m.prevFrameValue)) / dt) * 1000 : 0;
}

/** The latest springTo per value, so a stale safety timer never overrides a newer animation. */
const latestSpring = new WeakMap<MotionValue<number>, object>();

/** Stop any spring on a value and put it at `to` now; a pending springTo's safety timer won't override it. */
export function settle(value: MotionValue<number>, to: number) {
  latestSpring.set(value, {});
  value.stop();
  value.jump(to);
}

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
  const speed = opts.speed ?? 1;
  // Velocities are measured in real time, but the spring runs on its own clock, slowed or sped
  // up by `speed`. Convert, or a turn-around in slow motion starts almost from rest (it stopped dead).
  const velocity =
    opts.velocity !== undefined && Number.isFinite(opts.velocity) ? opts.velocity / Math.max(speed, 0.01) : undefined;
  const controls = animate(value, to, {
    type: "spring",
    ...springPhysics(spec),
    restDelta,
    restSpeed: restDelta * 12,
    ...(velocity === undefined ? {} : { velocity }),
  });
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
