// Shake detection, free of the DOM so it can be unit-tested with fake samples.
// It works on the change in acceleration between samples, which cancels
// gravity (a phone lying still reads ~9.8 m/s² on some axis, constantly), and
// wants several hard jolts in a short window, so a bump or a single flick of
// the wrist doesn't ask the ball.

export interface Sample {
  x: number;
  y: number;
  z: number;
}

export interface ShakeOptions {
  jerkThreshold: number; // m/s² change between samples that counts as a jolt
  jolts: number; // jolts needed inside the window
  windowMs: number;
  minGapMs: number; // one physical jolt spans several samples; count it once
  cooldownMs: number; // after a shake fires, ignore the tail of the same motion
}

export const DEFAULT_SHAKE: ShakeOptions = {
  jerkThreshold: 14,
  jolts: 3,
  windowMs: 900,
  minGapMs: 90,
  cooldownMs: 1500,
};

// Feed it every devicemotion sample; it returns true on the sample that completes a shake.
export function createShakeDetector(options: ShakeOptions = DEFAULT_SHAKE) {
  let previous: Sample | undefined;
  let joltTimes: number[] = [];
  let blockedUntil = -Infinity;

  return (sample: Sample, now: number): boolean => {
    const last = previous;
    previous = sample;
    if (!last || now < blockedUntil) return false;

    const jerk = Math.hypot(sample.x - last.x, sample.y - last.y, sample.z - last.z);
    if (jerk < options.jerkThreshold) return false;

    const lastJolt = joltTimes[joltTimes.length - 1];
    if (lastJolt !== undefined && now - lastJolt < options.minGapMs) return false;

    joltTimes = joltTimes.filter((t) => now - t <= options.windowMs);
    joltTimes.push(now);
    if (joltTimes.length < options.jolts) return false;

    joltTimes = [];
    blockedUntil = now + options.cooldownMs;
    return true;
  };
}
