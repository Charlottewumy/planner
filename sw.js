// 資安：v3 起不再快取 unpkg CDN（2026-07-30 資安健檢 F-04）
// 舊版對 unpkg 走 cache-first，一旦快取到被竄改的 React／Babel，之後每次開啟都會用它、且不再回源比對。
// 現在三支函式庫改成本機 ./lib/ 內的檔案，跟著 CORE 一起快取。
//
// v4 修正（2026-08-02）：舊版 fetch 處理沒檢查 HTTP 狀態，把伺服器回的 404 錯誤頁
// 當成正常檔案 put 進快取，而且 /lib/ 走 cache-first → 之後每次開啟都吐那份 404，
// 修好伺服器也救不回來（實際災情：GitHub repo 漏傳 lib/，三支函式庫全 404，
// 畫面只顯示看不懂的「Babel is not defined」）。
// 現在只有 res.ok 的回應才寫入快取；快取名升到 v4，activate 時會自動刪掉
// 存有 404 的 gz-cache-v3。
const CACHE = "gz-cache-v4";
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
// 只有成功的回應才進快取；404／500 一律不存，避免把錯誤頁鎖進快取。
function putIfOk(request, res) {
  if (res && res.ok) {
    const cl = res.clone();
    caches.open(CACHE).then((c) => c.put(request, cl));
  }
  return res;
}
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  // 本機靜態資源（含 ./lib/）：cache-first，離線也開得起來
  if (u.origin === self.location.origin && /\/lib\/.*\.js$/.test(u.pathname)) {
    e.respondWith(
      caches.match(e.request).then((r) => r || fetch(e.request).then((res) => putIfOk(e.request, res)))
    );
    return;
  }
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((res) => putIfOk(e.request, res))
        .catch(() => caches.match(e.request).then((r) => r || caches.match("./index.html")))
    );
  }
});
