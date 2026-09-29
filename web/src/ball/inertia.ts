// How the ball's face reacts to the phone: a mass on springs, free of the DOM
// so it can be unit-tested with fake sensor samples. The sphere stays fixed to
// the device (its light comes from the screen's own top-left); what moves is
// the layer of decals - the "8", the window, the floating answer:
//   - tilt: the layer rolls downhill, relative to how the phone is usually held
//   - jerk: it lags behind a jump or a shove and overshoots back
//   - spin: it counter-rotates, so the answer stays level like a die in liquid
// Samples are accelerationIncludingGravity in the SCREEN frame: x right, y up,
// z out of the screen, in m/s² (motionControl.ts converts from the device frame).
// At rest that reading points UP, against gravity: an upright phone reads
// y = +9.8, one lying face up reads z = +9.8, and turning it clockwise (right
// edge down) makes x negative.
import type { Sample } from "../shake.ts";

const G = 9.8;
const TAU_GRAVITY_S = 0.3; // slower than a jolt, faster than a hand turning the phone
const TAU_BASELINE_S = 5; // how long until "the way I'm holding it" becomes level
const TILT_GAIN = 0.3; // ball radii of roll per unit of tilt (sin of the side angle, radians of pitch)
const CALM_TOLERANCE = 3; // m/s² from 1 g
const JERK_GAIN = 0.7; // ball radii per second of velocity, per m/s² of shove (a 25 m/s² jump ≈ 0.15 radii)
const JERK_DEADZONE = 1.5; // m/s²: hand tremor and sensor noise
const MAX_OFFSET = 0.24; // ball radii; keeps the window inside the sphere
const SPRING_OFFSET = { omega: 12, zeta: 0.35 }; // bouncy: liquid, not a rigid mount
const SPRING_ROLL = { omega: 9, zeta: 0.4 };
const SUBSTEP_S = 1 / 240; // fixed steps keep the integration stable at any frame rate
const MAX_STEP_S = 0.05; // after a background tab, don't simulate the whole gap

export interface Inertia {
  x: number; // ball radii, positive = right
  y: number; // ball radii, positive = down (canvas)
  rollDeg: number; // counter-rotation of the decals
}

export const NO_INERTIA: Inertia = { x: 0, y: 0, rollDeg: 0 };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smoothstep = (lo: number, hi: number, v: number) => {
  const t = clamp((v - lo) / (hi - lo), 0, 1);
  return t * t * (3 - 2 * t);
};
// 0 with the phone upright, growing to a right angle as it is laid flat face up.
const pitchOf = (g: Sample) => Math.atan2(g.z, g.y);
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export class BallInertia {
  private gravity: Sample | undefined;
  private baseline = { x: 0, pitch: 0 };
  private lastFeedMs = 0;
  private lastStepMs: number | undefined;
  // Position, velocity and target of each spring.
  private ox = 0;
  private oy = 0;
  private vx = 0;
  private vy = 0;
  private roll = 0; // radians
  private vroll = 0;
  private targetX = 0;
  private targetY = 0;
  private targetRoll = 0;

  feed(sample: Sample, nowMs: number) {
    if (!this.gravity) {
      this.gravity = { ...sample };
      this.baseline = { x: clamp(sample.x / G, -1, 1), pitch: pitchOf(sample) };
      this.lastFeedMs = nowMs;
      return;
    }
    const dt = clamp((nowMs - this.lastFeedMs) / 1000, 0.001, 0.1);
    this.lastFeedMs = nowMs;

    const g = this.gravity;
    // Only a calm sample (about 1 g in total) says which way down is. During a
    // shove the total is far from 1 g, and folding it in would read the shove
    // as a sudden tilt that cancels its own kick.
    if (Math.abs(Math.hypot(sample.x, sample.y, sample.z) - G) < CALM_TOLERANCE) {
      const follow = 1 - Math.exp(-dt / TAU_GRAVITY_S);
      g.x += (sample.x - g.x) * follow;
      g.y += (sample.y - g.y) * follow;
      g.z += (sample.z - g.z) * follow;

      const tiltX = clamp(g.x / G, -1, 1);
      const pitch = pitchOf(g);
      const recenter = 1 - Math.exp(-dt / TAU_BASELINE_S);
      this.baseline.x += (tiltX - this.baseline.x) * recenter;
      this.baseline.pitch += (pitch - this.baseline.pitch) * recenter;

      // Downhill: the layer rolls right when the right edge dips (x reads
      // negative), and toward the bottom edge when the phone leans back (pitch
      // grows toward lying flat).
      this.targetX = -(tiltX - this.baseline.x) * TILT_GAIN;
      this.targetY = (pitch - this.baseline.pitch) * TILT_GAIN;

      // The screen plane's share of gravity says which way is down when the phone
      // is upright; lying flat there is no "down" on screen, so fade the roll out.
      const inPlane = Math.hypot(g.x, g.y) / G;
      this.targetRoll = Math.atan2(g.x, g.y) * smoothstep(0.35, 0.7, inPlane);
    }

    // The rest of the sample is a shove. The layer lags it: opposite in x, and
    // in y (up for the device is down for the layer's canvas coordinates).
    let ax = sample.x - g.x;
    let ay = sample.y - g.y;
    const shove = Math.hypot(ax, ay);
    if (shove <= JERK_DEADZONE) {
      ax = 0;
      ay = 0;
    } else {
      const scale = (shove - JERK_DEADZONE) / shove;
      ax *= scale;
      ay *= scale;
    }
    this.vx -= JERK_GAIN * ax * dt;
    this.vy += JERK_GAIN * ay * dt;
  }

  // Advances the springs to `nowMs` and returns the pose to draw.
  step(nowMs: number): Inertia {
    const last = this.lastStepMs ?? nowMs;
    this.lastStepMs = nowMs;
    let remaining = clamp((nowMs - last) / 1000, 0, MAX_STEP_S);
    while (remaining > 1e-9) {
      const h = Math.min(SUBSTEP_S, remaining);
      remaining -= h;
      this.integrate(h);
    }
    // Rounded so a settled ball produces an identical frame every time (and so
    // isn't redrawn), and sensor noise below the rounding never repaints it.
    return {
      x: Math.round(this.ox * 1000) / 1000,
      y: Math.round(this.oy * 1000) / 1000,
      rollDeg: Math.round(((this.roll * 180) / Math.PI) * 10) / 10,
    };
  }

  private integrate(h: number) {
    const kx = SPRING_OFFSET.omega ** 2;
    const cx = 2 * SPRING_OFFSET.zeta * SPRING_OFFSET.omega;
    this.vx += (-kx * (this.ox - this.targetX) - cx * this.vx) * h;
    this.vy += (-kx * (this.oy - this.targetY) - cx * this.vy) * h;
    this.ox += this.vx * h;
    this.oy += this.vy * h;

    // The layer meets the sphere's edge and bounces off it, losing most of its speed.
    const radius = Math.hypot(this.ox, this.oy);
    if (radius > MAX_OFFSET) {
      const nx = this.ox / radius;
      const ny = this.oy / radius;
      this.ox = nx * MAX_OFFSET;
      this.oy = ny * MAX_OFFSET;
      const outward = this.vx * nx + this.vy * ny;
      if (outward > 0) {
        this.vx -= 1.3 * outward * nx;
        this.vy -= 1.3 * outward * ny;
      }
    }

    const kr = SPRING_ROLL.omega ** 2;
    const cr = 2 * SPRING_ROLL.zeta * SPRING_ROLL.omega;
    // Shortest way round, so turning the phone past upside-down doesn't unwind a full turn.
    this.vroll += (-kr * wrapAngle(this.roll - this.targetRoll) - cr * this.vroll) * h;
    this.roll = wrapAngle(this.roll + this.vroll * h);
  }
}
