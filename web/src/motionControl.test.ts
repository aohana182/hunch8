import { test } from "node:test";
import assert from "node:assert/strict";

// motionControl reads navigator/DeviceMotionEvent at import time; give it a phone.
Object.defineProperty(globalThis, "navigator", {
  value: { userAgent: "Android", platform: "Linux armv8l", maxTouchPoints: 5 },
  configurable: true,
});
const { toScreenFrame } = await import("./motionControl.ts");

const upright = { x: 0, y: 9.8, z: 0 };

test("portrait: the device's frame is the screen's frame", () => {
  assert.deepEqual(toScreenFrame(upright, 0), upright);
});

test("landscape (device turned counter-clockwise): the device's +x edge is the screen's top", () => {
  // With the device's top edge pointing left, world-up runs along the device's +x,
  // and on the screen that is straight up: the same reading as an upright portrait.
  assert.deepEqual(toScreenFrame({ x: 9.8, y: 0.5, z: 0 }, 90), { x: -0.5, y: 9.8, z: 0 });
});

test("upside down flips both axes, and z always stays out of the screen", () => {
  assert.deepEqual(toScreenFrame({ x: 1, y: 2, z: 3 }, 180), { x: -1, y: -2, z: 3 });
  assert.deepEqual(toScreenFrame({ x: 1, y: 2, z: 3 }, 270), { x: 2, y: -1, z: 3 });
  assert.deepEqual(toScreenFrame({ x: 1, y: 2, z: 3 }, -90), { x: 2, y: -1, z: 3 });
});
