const CACHE = "gz-cache-v1";
const CORE = ["./", "./index.html"];
const CDN = [
  "https://unpkg.com/react@18.2.0/umd/react.production.min.js",
  "https://unpkg.com/react-dom@18.2.0/umd/react-dom.production.min.js",
  "https://unpkg.com/@babel/standalone@7.23.5/babel.min.js"
];
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all([c.addAll(CORE).catch(()=>{}), c.addAll(CDN).catch(()=>{})]))
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
  const u = e.request.url;
  if (u.indexOf("unpkg.com") !== -1) {
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
