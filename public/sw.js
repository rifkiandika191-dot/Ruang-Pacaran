// ============================================================
//  Service Worker — Ruang Pacaran PWA
//  Cache-first untuk aset statis, network-first untuk halaman
// ============================================================
const VERSION  = "rp-v1";
const STATIC   = VERSION + "-static";

const PRECACHE = [
  "/",
  "/room",
  "/find",
  "/css/style.css",
  "/css/find.css",
  "/js/main.js",
  "/js/room.js",
  "/js/fun.js",
  "/js/chat.js",
  "/js/find.js",
  "/js/donation-effect.js",
  "/js/saran.js",
  "/manifest.json",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/apple-touch-icon.png",
];

// ── Install: pre-cache aset utama ──
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(STATIC).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

// ── Activate: hapus cache lama ──
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== STATIC).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: strategi berdasarkan tipe request ──
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Lewati: socket.io, API, upload, request luar domain
  if (
    url.pathname.startsWith("/socket.io") ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/uploads/") ||
    url.origin !== location.origin
  ) {
    return; // browser handle sendiri
  }

  // CSS / JS / Icons: cache-first
  if (
    url.pathname.startsWith("/css/") ||
    url.pathname.startsWith("/js/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.json"
  ) {
    e.respondWith(
      caches.match(e.request).then((cached) => cached || fetch(e.request))
    );
    return;
  }

  // Halaman HTML: network-first (agar selalu fresh), fallback ke cache
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(STATIC).then((c) => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
