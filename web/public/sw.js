// Hunch8 service worker: makes the app open offline after one visit (the
// ask itself still needs the network, and says so). The build stamps
// VERSION and PRECACHE (see vite.config.ts), so every deploy gets a fresh
// cache and the old one is deleted.
const VERSION = "dev";
const PRECACHE = /* precache */ [];
const CACHE = `hunch8-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("hunch8-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // Only this site's own files. The question to the proxy (a cross-origin
  // POST) is never touched, so it can't be served stale or cached.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Pages: network first, so a new deploy shows up on the next online load.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE).then((cache) => cache.put("/", copy)));
          }
          return response;
        })
        .catch(() => caches.match("/", { ignoreVary: true })),
    );
    return;
  }

  // Hashed assets and icons never change under the same URL: cache first.
  // ignoreVary: Vite loads the JS/CSS with crossorigin, so those requests
  // carry an Origin header the precached copies don't; a server that answers
  // "Vary: Origin" would otherwise make every offline lookup miss.
  event.respondWith(
    caches.match(request, { ignoreVary: true }).then(
      (hit) =>
        hit ??
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)));
          }
          return response;
        }),
    ),
  );
});
