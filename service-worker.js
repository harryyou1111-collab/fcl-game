/* FCL 서비스 워커
   게임을 고쳐서 올렸는데 옛 버전이 계속 뜨는 걸 막으려고
   CACHE_VER 를 올리면 캐시가 통째로 갈린다.
   ── 게임을 수정할 때마다 이 숫자를 올리세요 ── */
const CACHE_VER = 'fcl-v1';

const CORE = [
  './',
  './fcl-game.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', e => {
  // 새 워커를 즉시 대기 상태에서 풀어준다
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_VER).then(c => c.addAll(CORE).catch(() => {}))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VER).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // 게임 본체(HTML)는 항상 새 버전을 먼저 시도한다.
  // 캐시 우선으로 두면 수정해도 옛 화면이 계속 보인다.
  const isDoc = req.mode === 'navigate' || url.pathname.endsWith('.html');

  if (isDoc) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_VER).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('./fcl-game.html')))
    );
    return;
  }

  // 이미지·음악은 캐시 우선. 용량이 크고 잘 안 바뀐다.
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE_VER).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => hit))
  );
});
