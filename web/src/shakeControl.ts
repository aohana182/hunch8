// Wires the shake detector to the phone's motion sensor. The user opts in
// (iOS requires the permission prompt to come from a tap, and a phone that
// asks itself when jostled in a pocket would be a surprise); the choice is
// remembered on this device.
import { createShakeDetector } from "./shake.ts";

const KEY = "hunch8:shake";

// iOS Safari exposes requestPermission on the event class; other browsers don't.
type MotionEventWithPermission = typeof DeviceMotionEvent & { requestPermission?: () => Promise<"granted" | "denied"> };

// A phone or tablet, not a desktop that merely has the API defined.
export function shakeSupported(): boolean {
  return typeof DeviceMotionEvent !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
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

export interface ShakeControl {
  enabled: () => boolean;
  // Must be called from a tap. Resolves to whether shake is now on.
  set: (on: boolean) => Promise<boolean>;
}

export function setUpShake(onShake: () => void): ShakeControl {
  const detect = createShakeDetector();
  const permissionApi =
    typeof DeviceMotionEvent === "undefined" ? undefined : (DeviceMotionEvent as MotionEventWithPermission).requestPermission;
  let listening = false;

  const handler = (event: DeviceMotionEvent) => {
    const a = event.accelerationIncludingGravity;
    if (!a || a.x == null || a.y == null || a.z == null) return;
    if (detect({ x: a.x, y: a.y, z: a.z }, event.timeStamp)) onShake();
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
  if (shakeSupported() && readPreference()) {
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
