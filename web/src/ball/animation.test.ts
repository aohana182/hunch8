import { test } from "node:test";
import assert from "node:assert/strict";
import { Animated, fastOutSlowIn, linear, repeatReverse, springAt, type AnimationSpec } from "./animation.ts";

const REVEAL_SPRING: AnimationSpec = { type: "spring", dampingRatio: 0.45, stiffness: 50 }; // BallComposable.kt

test("fastOutSlowIn starts at 0, ends at 1, and never goes backwards", () => {
  assert.equal(fastOutSlowIn(0), 0);
  assert.equal(fastOutSlowIn(1), 1);
  let previous = 0;
  for (let i = 1; i <= 100; i++) {
    const y = fastOutSlowIn(i / 100);
    assert.ok(y >= previous - 1e-9, `not monotonic at ${i / 100}`);
    previous = y;
  }
});

test("fastOutSlowIn matches cubic-bezier(0.4, 0, 0.2, 1) at its midpoint", () => {
  // Reference from sampling the curve independently (1e6 points): x = 0.5 -> y ≈ 0.77556
  assert.ok(Math.abs(fastOutSlowIn(0.5) - 0.77556) < 0.0001, String(fastOutSlowIn(0.5)));
});

test("the reveal spring overshoots its target, then settles on it", () => {
  let max = 0;
  for (let t = 0; t <= 3; t += 0.001) max = Math.max(max, springAt(t, 0, 1, 0, 0.45, 50).value);
  assert.ok(max > 1.15 && max < 1.25, `overshoot peak ${max}`); // underdamped ζ=0.45 → ~20% overshoot
  assert.ok(Math.abs(springAt(3, 0, 1, 0, 0.45, 50).value - 1) < 0.01);
});

test("repeatReverse ping-pongs like Compose's RepeatMode.Reverse", () => {
  assert.equal(repeatReverse(0, 100, linear), 0);
  assert.equal(repeatReverse(50, 100, linear), 0.5);
  assert.ok(Math.abs(repeatReverse(150, 100, linear) - 0.5) < 1e-9); // on the way back
  assert.ok(Math.abs(repeatReverse(200, 100, linear)) < 1e-9); // back at the start
});

test("a tween reaches its target exactly at its duration", () => {
  const a = new Animated(0);
  a.animateTo(180, { type: "tween", durationMs: 750, easing: fastOutSlowIn }, 0);
  a.tick(375);
  assert.ok(a.value > 90, "fast-out: past halfway at half time");
  a.tick(750);
  assert.equal(a.value, 180);
  assert.equal(a.isRunning, false);
});

test("animateTo resolves true when finished and false when interrupted, like a cancelled coroutine", async () => {
  const a = new Animated(0);
  const first = a.animateTo(1, { type: "tween", durationMs: 100, easing: linear }, 0);
  a.tick(50);
  const second = a.animateTo(0, { type: "tween", durationMs: 100, easing: linear }, 50);
  a.tick(150);
  assert.equal(await first, false);
  assert.equal(await second, true);
  assert.equal(a.value, 0);
});

test("spring animation is frame-rate independent: 30 fps and 120 fps agree", () => {
  const run = (fps: number) => {
    const a = new Animated(0);
    a.animateTo(1, REVEAL_SPRING, 0);
    for (let t = 0; t <= 400; t += 1000 / fps) a.tick(t);
    a.tick(400);
    return a.value;
  };
  assert.ok(Math.abs(run(30) - run(120)) < 1e-9);
});

test("a spring keeps the current velocity when retargeted mid-flight", () => {
  const a = new Animated(0);
  a.animateTo(1, REVEAL_SPRING, 0);
  a.tick(100);
  const valueAt100 = a.value;
  a.animateTo(2, REVEAL_SPRING, 100);
  a.tick(116);
  assert.ok(a.value > valueAt100, "still moving forward, not restarting from rest");
});

test("snapTo stops any running animation", async () => {
  const a = new Animated(0);
  const running = a.animateTo(1, { type: "tween", durationMs: 100, easing: linear }, 0);
  a.snapTo(0.25);
  a.tick(100);
  assert.equal(a.value, 0.25);
  assert.equal(await running, false);
});
