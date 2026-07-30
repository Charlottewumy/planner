// 資安：v3 起不再快取 unpkg CDN（2026-07-30 資安健檢 F-04）
// 舊版對 unpkg 走 cache-first，一旦快取到被竄改的 React／Babel，之後每次開啟都會用它、且不再回源比對。
// 現在三支函式庫改成本機 ./lib/ 內的檔案，跟著 CORE 一起快取；
// 快取名改 v3 → activate 時會自動刪掉 v1／v2，把可能已被污染的 unpkg 快取一併清掉。
const CACHE = "gz-cache-v3";
const CORE = [
  "./",
  "./index.html",
  "./lib/react.production.min.js",
  "./lib/react-dom.production.min.js",
  "./lib/babel.min.js"
];
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(CORE).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  // 本機靜態資源（含 ./lib/）：cache-first，離線也開得起來
  if (u.origin === self.location.origin && /\/lib\/.*\.js$/.test(u.pathname)) {
    e.respondWith(
      caches.match(e.request).then((r) => r || fetch(e.request).then((res) => {
        const cl = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, cl));
        return res;
      }))
    );
    return;
  }
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request).then((res) => {
        const cl = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, cl));
        return res;
      }).catch(() => caches.match(e.request).then((r) => r || caches.match("./index.html")))
    );
  }
});
