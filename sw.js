const CACHE = "cuentas-claras-v70";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./privacy.html",
  "./data-policy.html",
  "./terms.html",
  "./contact.html",
  "./src/css/base.css?v=v70",
  "./src/css/components.css?v=v70",
  "./src/css/pages.css?v=v70",
  "./src/js/icons.js?v=v70",
  "./src/js/i18n.js?v=v70",
  "./src/js/storage.js?v=v70",
  "./src/js/migrations.js?v=v70",
  "./src/js/state.js?v=v70",
  "./src/js/calculations.js?v=v70",
  "./src/js/categories.js?v=v70",
  "./src/js/work.js?v=v70",
  "./src/js/payments.js?v=v70",
  "./src/js/bank.js?v=v70",
  "./src/js/api.js?v=v70",
  "./src/js/plaid-link.js?v=v70",
  "./src/js/history.js?v=v70",
  "./src/js/recommendations.js?v=v70",
  "./src/js/render.js?v=v70",
  "./src/js/app.js?v=v70",
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
    (req.mode === "navigate" ? fetch(req.url, { cache: "no-cache" }) : fetch(req))
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
