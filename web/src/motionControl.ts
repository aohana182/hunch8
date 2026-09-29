// The phone's motion sensor, for shake-to-ask and for the ball's inertia. The
// user opts in once for both (iOS requires the permission prompt to come from
// a tap, and a phone that asks itself when jostled in a pocket would be a
// surprise); the choice is remembered on this device.
import type { Sample } from "./shake.ts";

const KEY = "hunch8:motion";

// iOS Safari exposes requestPermission on the event class; other browsers don't.
type MotionEventWithPermission = typeof DeviceMotionEvent & { requestPermission?: () => Promise<"granted" | "denied"> };

// A phone or tablet, not a desktop that merely has the API defined.
export function motionSupported(): boolean {
  return typeof DeviceMotionEvent !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

// iOS Safari reports accelerationIncludingGravity with the opposite sign to the
// spec and Chrome (a phone lying face up reads z = -9.8). UNVERIFIED on a real
// iPhone: if the ball rolls or spins the wrong way there, this is the switch.
const INVERTED_AXES = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// The sensor reports in the device's own frame; the ball needs the screen's, which
// turns with the page when the phone is held sideways (angle 90 = device turned
// counter-clockwise, so the device's top edge points to the screen's left).
export function toScreenFrame(a: Sample, angleDeg: number): Sample {
  switch (((angleDeg % 360) + 360) % 360) {
    case 90:
      return { x: -a.y, y: a.x, z: a.z };
    case 180:
      return { x: -a.x, y: -a.y, z: a.z };
    case 270:
      return { x: a.y, y: -a.x, z: a.z };
    default:
      return a;
  }
}

function readPreference(): boolean {
  try {
    return localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

function writePreference(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Not remembered (private window): it still works for this visit.
  }
}

export interface MotionControl {
  enabled: () => boolean;
  // Must be called from a tap. Resolves to whether motion is now on.
  set: (on: boolean) => Promise<boolean>;
}

export function setUpMotion(onSample: (sample: Sample, timeMs: number) => void): MotionControl {
  const permissionApi =
    typeof DeviceMotionEvent === "undefined" ? undefined : (DeviceMotionEvent as MotionEventWithPermission).requestPermission;
  let listening = false;

  const handler = (event: DeviceMotionEvent) => {
    const a = event.accelerationIncludingGravity;
    if (!a || a.x == null || a.y == null || a.z == null) return;
    const sign = INVERTED_AXES ? -1 : 1;
    const device = { x: sign * a.x, y: sign * a.y, z: sign * a.z };
    onSample(toScreenFrame(device, screen.orientation?.angle ?? 0), event.timeStamp);
  };

  const listen = (on: boolean) => {
    if (on === listening) return;
    listening = on;
    if (on) window.addEventListener("devicemotion", handler);
    else window.removeEventListener("devicemotion", handler);
  };

  const requestPermission = async (): Promise<boolean> => {
    if (typeof permissionApi !== "function") return true;
    try {
      return (await (DeviceMotionEvent as MotionEventWithPermission).requestPermission!()) === "granted";
    } catch {
      return false;
    }
  };

  let enabled = false;

  // Remembered "on": Android can listen straight away. iOS needs the
  // permission again from a gesture, so it waits for the first tap anywhere.
  if (motionSupported() && readPreference()) {
    enabled = true;
    if (typeof permissionApi === "function") {
      document.addEventListener(
        "pointerup",
        async () => {
          if (!enabled) return;
          if (await requestPermission()) listen(true);
          else enabled = false;
        },
        { once: true },
      );
    } else {
      listen(true);
    }
  }

  return {
    enabled: () => enabled,
    set: async (on) => {
      if (on && !(await requestPermission())) on = false;
      enabled = on;
      listen(on);
      writePreference(on);
      return on;
    },
  };
}
