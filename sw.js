/* 特別支援教育 指導支援ハンドブック — Service Worker
 *
 * 方針：
 *   HTML と JSON は「ネットワーク優先」。更新した内容が必ず端末に届くようにする。
 *   CSS / JS / 画像は「キャッシュ優先」。表示速度を確保する。
 *   VERSION を変えると古いキャッシュは activate 時に破棄される。
 *
 * 注意：VERSION は meta.json の "version" と揃えること。
 *       内容を更新したらここも必ず書き換える。
 */
const VERSION = "2.8.1";
const CACHE_NAME = `tokushi-guidebook-${VERSION}`;

const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./style.css",
  "./app.js",
  "./sw-register.js",
  "./icon-192.png",
  "./icon-512.png",
  "./meta.json",
  "./sources.json",
  "./jiritsu27.json",
  "./categories.json",
  "./visual.json",
  "./hearing.json",
  "./intellectual.json",
  "./physical.json",
  "./health.json",
  "./language.json",
  "./autism.json",
  "./emotional.json",
  "./ld.json",
  "./adhd.json",
  "./futoukou.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // 1本でも失敗すると install ごと失敗するため、個別に握りつぶす
      .then((cache) => Promise.all(
        PRECACHE.map((url) => cache.add(url).catch(() => null))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

function networkFirst(request) {
  return fetch(request)
    .then((response) => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    })
    .catch(() => caches.match(request).then((cached) => {
      if (cached) return cached;
      // ドキュメント要求がオフラインで未キャッシュのときはトップを返す
      if (request.mode === "navigate") return caches.match("./index.html");
      return Response.error();
    }));
}

function cacheFirst(request) {
  return caches.match(request).then((cached) => {
    if (cached) return cached;
    return fetch(request).then((response) => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    });
  });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // 別オリジン（文科省のPDF等）はSWを通さず、そのままブラウザに任せる
  if (url.origin !== self.location.origin) return;

  const isDocument = request.mode === "navigate" || request.destination === "document";
  const isData = url.pathname.endsWith(".json");

  event.respondWith(isDocument || isData ? networkFirst(request) : cacheFirst(request));
});

// ページ側から更新を促せるようにしておく
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
