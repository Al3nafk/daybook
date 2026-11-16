// Network first so updates arrive whenever the phone is online; the cache keeps Daybook working offline.
const CACHE = "daybook-shell";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png", "firebase-config.js"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  // Only the app itself, its fonts and the Firebase libraries; sign-in and sync traffic goes straight to the network.
  const host = new URL(req.url).hostname;
  if (host !== self.location.hostname && !["fonts.googleapis.com", "fonts.gstatic.com", "www.gstatic.com"].includes(host)) return;
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })
        .then(hit => hit || (req.mode === "navigate" ? caches.match("index.html") : Response.error())))
  );
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window" }).then(list => list[0] ? list[0].focus() : self.clients.openWindow("./")));
});
