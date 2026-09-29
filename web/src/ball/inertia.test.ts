import { test } from "node:test";
import assert from "node:assert/strict";
import { BallInertia, type Inertia } from "./inertia.ts";
import type { Sample } from "../shake.ts";

// The sensor reads against gravity, so turning the phone clockwise (right edge down) makes x negative.
const upright = (clockwiseDeg = 0): Sample => {
  const a = (clockwiseDeg * Math.PI) / 180;
  return { x: -9.8 * Math.sin(a), y: 9.8 * Math.cos(a), z: 0 };
};
const flat: Sample = { x: 0, y: 0, z: 9.8 };
const ORIGIN: Inertia = { x: 0, y: 0, rollDeg: 0 };

// Feeds `sample` at 60 Hz for `seconds`, stepping every frame; returns the last pose.
function run(ball: BallInertia, sample: Sample, seconds: number, start = 0): { pose: Inertia; end: number } {
  let pose = ORIGIN;
  let t = start;
  for (let i = 0; i < seconds * 60; i++) {
    t += 1000 / 60;
    ball.feed(sample, t);
    pose = ball.step(t);
  }
  return { pose, end: t };
}

test("a phone held still stays centered", () => {
  const ball = new BallInertia();
  assert.deepEqual(run(ball, upright(), 3).pose, ORIGIN);
});

test("tilting the phone clockwise rolls the face right; tilting back lets it sag down", () => {
  const ball = new BallInertia();
  const held = run(ball, upright(), 10);
  const right = run(ball, upright(25), 1.5, held.end).pose;
  assert.ok(right.x > 0.05, `x ${right.x}`);
  assert.ok(Math.abs(right.y) < 0.05);

  const back = new BallInertia();
  const start = run(back, upright(), 10);
  const tiltedBack = run(back, { x: 0, y: 9.8 * Math.cos(0.5), z: 9.8 * Math.sin(0.5) }, 1.5, start.end).pose;
  assert.ok(tiltedBack.y > 0.05, `y ${tiltedBack.y}`);
});

test("the face counter-rotates when the phone spins, so the answer stays level", () => {
  const ball = new BallInertia();
  const clockwise = run(ball, upright(30), 3).pose;
  assert.ok(Math.abs(clockwise.rollDeg + 30) < 3, `roll ${clockwise.rollDeg}`);
});

test("lying flat has no 'down' on the screen, so nothing rotates", () => {
  const ball = new BallInertia();
  run(ball, upright(40), 3);
  const { pose } = run(ball, flat, 4, 3000);
  assert.ok(Math.abs(pose.rollDeg) < 1, `roll ${pose.rollDeg}`);
});

test("how the phone is usually held becomes level after a few seconds", () => {
  const ball = new BallInertia();
  run(ball, upright(), 2);
  const { pose } = run(ball, { x: 0, y: 9.8 * Math.cos(0.7), z: 9.8 * Math.sin(0.7) }, 40, 2000);
  assert.ok(Math.abs(pose.y) < 0.02, `y ${pose.y}`);
});

test("a jump kicks the face against the motion, then it settles back", () => {
  const ball = new BallInertia();
  let t = run(ball, upright(), 2).end;
  let peak = 0;
  // 100 ms shove to the right at 25 m/s², like a lunge with the phone.
  for (let i = 0; i < 6; i++) {
    t += 1000 / 60;
    ball.feed({ ...upright(), x: 25 }, t);
    peak = Math.min(peak, ball.step(t).x);
  }
  for (let i = 0; i < 20; i++) {
    t += 1000 / 60;
    ball.feed(upright(), t);
    peak = Math.min(peak, ball.step(t).x);
  }
  assert.ok(peak < -0.05, `peak ${peak}`);
  const rest = run(ball, upright(), 4, t).pose;
  assert.ok(Math.abs(rest.x) < 0.01, `rest ${rest.x}`);
});

test("hand tremor and sensor noise don't move it", () => {
  const ball = new BallInertia();
  let t = 0;
  let pose = ORIGIN;
  for (let i = 0; i < 300; i++) {
    t += 1000 / 60;
    ball.feed({ x: i % 2 ? 0.4 : -0.4, y: 9.8 + (i % 3 ? 0.3 : -0.3), z: 0.2 }, t);
    pose = ball.step(t);
  }
  assert.ok(Math.abs(pose.x) < 0.01 && Math.abs(pose.y) < 0.01, JSON.stringify(pose));
});

test("however violent the shaking, the face never leaves the sphere", () => {
  const ball = new BallInertia();
  let t = 0;
  for (let i = 0; i < 600; i++) {
    t += 1000 / 60;
    ball.feed({ x: i % 2 ? 60 : -60, y: 9.8 + (i % 4 ? 50 : -50), z: 0 }, t);
    const pose = ball.step(t);
    assert.ok(Math.hypot(pose.x, pose.y) <= 0.2415, JSON.stringify(pose));
  }
});

test("a long pause (background tab) is not simulated as one giant step", () => {
  const ball = new BallInertia();
  run(ball, upright(), 1);
  ball.step(5000);
  const pose = ball.step(60_000);
  assert.ok(Number.isFinite(pose.x) && Math.hypot(pose.x, pose.y) <= 0.2415);
});
