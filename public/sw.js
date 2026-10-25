/* KCC 스위첸 커뮤니티 서비스 워커
 * - 페이지 이동: 네트워크 우선, 실패하면 캐시 → 그것도 없으면 오프라인 화면
 * - 정적 파일(스크립트·스타일·이미지·글꼴): 캐시해 두고 빠르게 열기
 * - 로그인·데이터(Supabase)·API 요청은 건드리지 않는다(항상 네트워크).
 */
const VERSION = "v1";
const STATIC = `static-${VERSION}`;
const PAGES = `pages-${VERSION}`;
const PRECACHE = ["/offline.html", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keep = new Set([STATIC, PAGES]);
      for (const k of await caches.keys()) if (!keep.has(k)) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});

// 새 버전 안내 배너에서 '새로고침'을 누르면 대기 중인 새 워커를 바로 적용한다.
self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});

const cacheable = (res) => res && res.status === 200 && (res.type === "basic" || res.type === "cors");

async function networkFirst(req) {
  const cache = await caches.open(PAGES);
  try {
    const res = await fetch(req);
    if (cacheable(res)) cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req)) || (await caches.match("/offline.html"));
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (cacheable(res)) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(req);
  const refresh = fetch(req).then((res) => { if (cacheable(res)) cache.put(req, res.clone()); return res; }).catch(() => hit);
  return hit || refresh;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // 구글 폰트(글꼴 파일)는 캐시해 오프라인에서도 글꼴이 유지되게 한다.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(staleWhileRevalidate(req));
    return;
  }
  if (url.origin !== self.location.origin) return; // Supabase 등 외부 요청은 그대로
  if (url.pathname.startsWith("/api/") || url.searchParams.has("_rsc")) return;

  if (req.mode === "navigate") {
    e.respondWith(networkFirst(req));
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    e.respondWith(cacheFirst(req));
    return;
  }
  if (["style", "script", "font", "image"].includes(req.destination)) {
    e.respondWith(staleWhileRevalidate(req));
  }
});
