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

// A payment screenshot shared to Daybook from the phone's Share menu: keep the image and open the app to record it.
async function takeShare(req) {
  try {
    const form = await req.formData();
    const file = form.get("receipt");
    if (file && file.size) {
      const c = await caches.open("daybook-share");
      await c.put("shared-receipt", new Response(file, { headers: { "Content-Type": file.type || "image/png" } }));
    }
  } catch {}
  return Response.redirect("./?receipt=1#money", 303);
}

self.addEventListener("fetch", e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method === "POST" && url.pathname.endsWith("/share-receipt")) { e.respondWith(takeShare(req)); return; }
  if (req.method !== "GET") return;
  // Only the app itself, its fonts, the Firebase libraries and the offline text reader; sign-in and sync traffic goes straight to the network.
  const host = url.hostname;
  if (host !== self.location.hostname && !["fonts.googleapis.com", "fonts.gstatic.com", "www.gstatic.com", "cdn.jsdelivr.net", "tessdata.projectnaptha.com"].includes(host)) return;
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

// A reminder pushed by the Daybook reminder sender (arrives even when the app is closed, including on iPhone).
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: "Daybook", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Daybook reminder", {
    body: d.body || "", tag: d.key || undefined, icon: "icon-192.png", badge: "icon-192.png",
    data: { key: d.key || "", go: d.go || "", date: d.date || "" },
  }));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const x = e.notification.data || {};
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    if (list[0]) { list[0].postMessage({ type: "open", ...x }); return list[0].focus(); }
    return self.clients.openWindow(x.go ? "./#" + x.go : "./");
  }));
});
