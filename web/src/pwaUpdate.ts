// Update policy for the installed app: a new service worker installs in the
// background and waits; it takes over only at a moment that costs the user
// nothing. The question and ball state survive a reload (session.ts), so the
// swap is invisible when the page is hidden and harmless when it is idle.

export interface UpdateContext {
  hidden: boolean; // the page is in the background
  busy: boolean; // a request is in flight
  typing: boolean; // the question box has focus
}

export function canApplyUpdate({ hidden, busy, typing }: UpdateContext): boolean {
  if (busy) return false; // never drop an answer that is on its way
  return hidden || !typing; // never yank the keyboard from under a half-typed question
}

const RECHECK_MS = 60 * 60 * 1000;

// Returns a function to call whenever the app might have become idle.
export function setUpUpdates(context: () => Omit<UpdateContext, "hidden">): () => void {
  if (!("serviceWorker" in navigator)) return () => {};
  const container = navigator.serviceWorker;
  let waiting: ServiceWorker | undefined;
  // First install has no controller yet: nothing to swap, no reload wanted.
  let hadController = !!container.controller;
  let reloading = false;

  const applyIfSafe = () => {
    if (!waiting || !canApplyUpdate({ hidden: document.hidden, ...context() })) return;
    waiting.postMessage("SKIP_WAITING");
    waiting = undefined;
  };

  container.addEventListener("controllerchange", () => {
    if (!hadController) {
      hadController = true; // the very first worker claiming the page
      return;
    }
    if (reloading) return;
    reloading = true;
    location.reload();
  });

  container
    .register("/sw.js")
    .then((registration) => {
      const track = (worker: ServiceWorker | null) => {
        if (!worker || !container.controller) return;
        waiting = worker;
        applyIfSafe();
      };
      track(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        installing?.addEventListener("statechange", () => {
          if (installing.state === "installed") track(installing);
        });
      });

      // The browser only looks for a new sw.js on navigation, and an installed
      // app can stay alive for days: check on every return to the app and hourly.
      const check = () => registration.update().catch(() => {});
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) applyIfSafe();
        else check();
      });
      setInterval(check, RECHECK_MS);
    })
    .catch(() => {
      // No offline support (e.g. a private window) - the app works the same online.
    });

  return applyIfSafe;
}
