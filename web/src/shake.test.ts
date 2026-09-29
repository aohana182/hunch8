import { test } from "node:test";
import assert from "node:assert/strict";
import { createShakeDetector, DEFAULT_SHAKE, type Sample } from "./shake.ts";

const still: Sample = { x: 0, y: 0, z: 9.8 };
const left: Sample = { x: 12, y: 0, z: 9.8 };
const right: Sample = { x: -12, y: 0, z: 9.8 };

// Feeds alternating hard jolts every `gap` ms and returns the timestamps that fired.
function shake(detect: ReturnType<typeof createShakeDetector>, start: number, count: number, gap: number) {
  const fired: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = start + i * gap;
    if (detect(i % 2 === 0 ? left : right, t)) fired.push(t);
  }
  return fired;
}

test("a phone lying still, or moving gently, never fires (gravity is ignored)", () => {
  const detect = createShakeDetector();
  detect(still, 0);
  for (let t = 16; t < 3000; t += 16) assert.equal(detect({ x: 0.2, y: -0.1, z: 9.9 }, t), false);
});

test("three hard jolts inside the window fire once", () => {
  const detect = createShakeDetector();
  detect(still, 0);
  assert.deepEqual(shake(detect, 100, 6, 150), [550]);
});

test("a single flick or a bump does not fire", () => {
  const detect = createShakeDetector();
  detect(still, 0);
  assert.deepEqual(shake(detect, 100, 2, 150), []);
});

test("jolts spread wider than the window do not add up", () => {
  const detect = createShakeDetector();
  detect(still, 0);
  assert.deepEqual(shake(detect, 100, 6, DEFAULT_SHAKE.windowMs), []);
});

test("one physical jolt spanning several samples counts once", () => {
  const detect = createShakeDetector();
  detect(still, 0);
  // 60 Hz samples: 16 ms apart, alternating hard, all inside minGapMs.
  assert.deepEqual(shake(detect, 100, 8, 16), []);
});

test("after a shake, the tail of the same motion is ignored until the cooldown ends", () => {
  const detect = createShakeDetector();
  detect(still, 0);
  assert.equal(shake(detect, 100, 6, 150).length, 1); // fires at 550, blocked until 2050
  assert.deepEqual(shake(detect, 1000, 3, 150), []);
  assert.equal(shake(detect, 2000, 4, 150).length, 1);
});
