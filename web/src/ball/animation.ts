// Just enough of Compose's animation model to port BallComposable.kt:
// Animatable.animateTo/snapTo with tween() and spring(), plus the
// infiniteRepeatable(..., RepeatMode.Reverse) used for the bob and shake.
// Values are computed from elapsed time, never accumulated per frame, so the
// motion is identical at 30, 60 or 120 fps.

export type Easing = (x: number) => number;

export const linear: Easing = (x) => x;

// Compose's FastOutSlowInEasing = CubicBezierEasing(0.4f, 0f, 0.2f, 1f).
export const fastOutSlowIn: Easing = cubicBezier(0.4, 0, 0.2, 1);

function cubicBezier(x1: number, y1: number, x2: number, y2: number): Easing {
  const coord = (s: number, p1: number, p2: number) => 3 * (1 - s) ** 2 * s * p1 + 3 * (1 - s) * s ** 2 * p2 + s ** 3;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    // x(s) is monotonic for these control points, so bisection always converges.
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (coord(mid, x1, x2) < x) lo = mid;
      else hi = mid;
    }
    return coord((lo + hi) / 2, y1, y2);
  };
}

// 0→1 then 1→0, repeating: the eased fraction of an infiniteRepeatable with
// RepeatMode.Reverse at `elapsedMs`.
export function repeatReverse(elapsedMs: number, durationMs: number, easing: Easing): number {
  const iteration = Math.floor(elapsedMs / durationMs);
  const fraction = (elapsedMs % durationMs) / durationMs;
  return iteration % 2 === 0 ? easing(fraction) : easing(1 - fraction);
}

// Closed-form damped harmonic oscillator (unit mass), the same model as
// Compose's SpringSimulation. `t` in seconds, velocity in units per second.
export function springAt(
  t: number,
  from: number,
  to: number,
  initialVelocity: number,
  dampingRatio: number,
  stiffness: number,
): { value: number; velocity: number; envelope: number } {
  const x0 = from - to;
  const v0 = initialVelocity;
  const w0 = Math.sqrt(stiffness);
  const z = dampingRatio;

  if (z < 1) {
    const wd = w0 * Math.sqrt(1 - z * z);
    const a = x0;
    const b = (v0 + z * w0 * x0) / wd;
    const decay = Math.exp(-z * w0 * t);
    const cos = Math.cos(wd * t);
    const sin = Math.sin(wd * t);
    const x = decay * (a * cos + b * sin);
    const v = decay * (-z * w0 * (a * cos + b * sin) + wd * (b * cos - a * sin));
    return { value: to + x, velocity: v, envelope: decay * Math.hypot(a, b) };
  }
  if (z === 1) {
    const c = v0 + w0 * x0;
    const decay = Math.exp(-w0 * t);
    const x = (x0 + c * t) * decay;
    return { value: to + x, velocity: c * decay - w0 * x, envelope: Math.abs(x) };
  }
  const root = Math.sqrt(z * z - 1);
  const r1 = -w0 * (z - root);
  const r2 = -w0 * (z + root);
  const c2 = (v0 - r1 * x0) / (r2 - r1);
  const c1 = x0 - c2;
  const x = c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t);
  const v = c1 * r1 * Math.exp(r1 * t) + c2 * r2 * Math.exp(r2 * t);
  return { value: to + x, velocity: v, envelope: Math.abs(x) };
}

export type AnimationSpec =
  | { type: "tween"; durationMs: number; easing: Easing }
  | { type: "spring"; dampingRatio: number; stiffness: number };

// Compose's default visibility threshold for a Float Animatable.
const VISIBILITY_THRESHOLD = 0.01;

interface Run {
  startMs: number;
  from: number;
  to: number;
  initialVelocity: number;
  spec: AnimationSpec;
  finish: (completed: boolean) => void;
}

// Port of Compose's Animatable: one value, at most one animation at a time.
// Starting a new animation (or snapping) cancels the running one, whose
// promise then resolves false - the equivalent of its coroutine being cancelled.
export class Animated {
  value: number;
  velocity = 0;
  private run: Run | null = null;

  constructor(initial: number) {
    this.value = initial;
  }

  get isRunning(): boolean {
    return this.run !== null;
  }

  get target(): number {
    return this.run ? this.run.to : this.value;
  }

  animateTo(target: number, spec: AnimationSpec, nowMs: number): Promise<boolean> {
    this.cancel();
    return new Promise((resolve) => {
      this.run = {
        startMs: nowMs,
        from: this.value,
        to: target,
        initialVelocity: this.velocity,
        spec,
        finish: resolve,
      };
    });
  }

  snapTo(value: number) {
    this.cancel();
    this.value = value;
    this.velocity = 0;
  }

  tick(nowMs: number) {
    const run = this.run;
    if (!run) return;
    const elapsedMs = Math.max(0, nowMs - run.startMs);

    if (run.spec.type === "tween") {
      const fraction = Math.min(1, elapsedMs / run.spec.durationMs);
      this.value = run.from + (run.to - run.from) * run.spec.easing(fraction);
      this.velocity = 0;
      if (fraction >= 1) this.complete(run);
      return;
    }

    const s = springAt(elapsedMs / 1000, run.from, run.to, run.initialVelocity, run.spec.dampingRatio, run.spec.stiffness);
    this.value = s.value;
    this.velocity = s.velocity;
    if (s.envelope < VISIBILITY_THRESHOLD) this.complete(run);
  }

  private complete(run: Run) {
    this.value = run.to;
    this.velocity = 0;
    this.run = null;
    run.finish(true);
  }

  private cancel() {
    const run = this.run;
    this.run = null;
    run?.finish(false);
  }
}
