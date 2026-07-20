const CACHE = "cuentas-claras-v27";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./src/css/base.css",
  "./src/css/components.css",
  "./src/css/pages.css",
  "./src/js/icons.js",
  "./src/js/i18n.js",
  "./src/js/storage.js",
  "./src/js/migrations.js",
  "./src/js/state.js",
  "./src/js/calculations.js",
  "./src/js/categories.js",
  "./src/js/work.js",
  "./src/js/payments.js",
  "./src/js/bank.js",
  "./src/js/history.js",
  "./src/js/recommendations.js",
  "./src/js/render.js",
  "./src/js/app.js",
];

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        // guarda copia fresca de los recursos propios de la app
        if (req.url.startsWith(self.location.origin)) {
          const resClone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, resClone));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
