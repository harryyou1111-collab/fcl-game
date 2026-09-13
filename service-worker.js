/* ══════════════════════════════════════════════════════════════
   FCL 서비스 워커
   ──────────────────────────────────────────────────────────────
   이전 방식은 파일을 고칠 때마다 CACHE_VER 를 직접 올려야 했다.
   깜빡하면 옛날 화면이 계속 나오고, 올려도 앱을 완전히 껐다 켜야 했다.

   이 버전은 "네트워크 우선" 방식이다.
     · 인터넷이 되면 항상 서버에서 최신 파일을 받아온다  → 캐시 문제가 안 생긴다
     · 받아온 파일은 캐시에 넣어둔다                      → 오프라인에서도 실행된다
     · 새 서비스 워커가 곧바로 활성화된다                  → 앱을 껐다 켤 필요가 없다

   앞으로는 게임 파일이나 선수 사진을 올리면 새로고침만 해도 바로 반영된다.
   CACHE_VER 를 다시 올릴 일은 없다.
   ══════════════════════════════════════════════════════════════ */

const CACHE = 'fcl-runtime-v1';

// 오프라인 대비로 미리 받아둘 최소 파일
const PRECACHE = [
  './',
  './fcl-game.html',
  './manifest.json',
];

self.addEventListener('install', (e) => {
  // 새 워커를 기다리지 않고 바로 대기 상태에서 꺼낸다
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      // 한 개라도 실패하면 전체가 실패하므로 개별 처리한다
      Promise.all(PRECACHE.map((u) => c.add(u).catch(() => {})))
    )
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())   // 열려 있는 탭도 바로 새 워커가 맡는다
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;

  // GET 이 아니거나 다른 도메인 요청은 건드리지 않는다
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        // 정상 응답이면 캐시를 최신으로 갱신해둔다
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        // 오프라인이면 저장해둔 걸로 대신한다
        caches.match(req).then((hit) =>
          hit || (req.mode === 'navigate' ? caches.match('./fcl-game.html') : undefined)
        )
      )
  );
});
