// Offline support for the woods: app + encrypted pin data stay cached, map tiles you've viewed stay cached,
// weather is network-first with the last good copy as fallback.
const APP = "dp-app-v2";
const TILES = "dp-tiles-v1";
const MAX_TILES = 4000;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(["./", "index.html", "manifest.json"])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

const isTile = u => /basemap\.nationalmap\.gov|arcgisonline\.com/.test(u.host);
const isWeather = u => /open-meteo\.com/.test(u.host) || u.pathname.includes("/weather/");

async function trimTiles() {
  const c = await caches.open(TILES);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - MAX_TILES; i++) await c.delete(keys[i]);
}

self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (isTile(u)) {
    e.respondWith(caches.open(TILES).then(async c => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const r = await fetch(e.request);
      if (r.ok || r.type === "opaque") { c.put(e.request, r.clone()); trimTiles(); }
      return r;
    }));
  } else if (isWeather(u)) {
    e.respondWith(fetch(e.request).then(r => {
      if (r.ok) caches.open(APP).then(c => c.put(e.request, r.clone()));
      return r;
    }).catch(() => caches.match(e.request)));
  } else if (u.origin === location.origin && (e.request.mode === "navigate" || /\/(index\.html|manifest\.json)?$/.test(u.pathname))) {
    // The page and manifest: network first so updates show up immediately; cache when offline.
    e.respondWith(fetch(e.request).then(r => { if (r.ok) caches.open(APP).then(c => c.put(e.request, r.clone())); return r; })
      .catch(() => caches.match(e.request).then(h => h || caches.match("index.html"))));
  } else if (u.origin === location.origin || /cdnjs|fonts\.g/.test(u.host)) {
    // Stale-while-revalidate: open instantly from cache, refresh in the background.
    e.respondWith(caches.open(APP).then(async c => {
      const hit = await c.match(e.request);
      const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
  }
});
