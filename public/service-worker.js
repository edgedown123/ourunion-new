/* ourunion service worker - cache bust build 20260205130957 */
const CACHE_NAME = 'ourunion-cache-20260205130957';
const CORE_ASSETS = [
  '/',           // index.html (navigation fallback)
  '/manifest.json',
];

// Install: take control ASAP
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => undefined)
  );
});

// Activate: claim clients + cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Never cache API or non-GET
  if (req.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return;
  }

  // Navigation: network-first, fallback to cache
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put('/', fresh.clone());
        return fresh;
      } catch (e) {
        const cached = await caches.match('/');
        return cached || Response.error();
      }
    })());
    return;
  }

  // Static assets: cache-first
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, fresh.clone());
      return fresh;
    } catch (e) {
      return cached || Response.error();
    }
  })());
});
// Push message handler
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: '우리노동조합', body: '새 게시글이 등록되었습니다.' };
  }

  const title = payload.title || '우리노동조합';
  const body = payload.body || '새 게시글이 등록되었습니다.';
  const url = payload.url || '/#tab=home';
  const tag = payload.tag || 'ourunion-new-post';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      renotify: true,
      data: { url },
      // 아이콘 경로는 manifest에 맞춰둠(빌드 시 생성/복사되는 것을 가정)
      icon: '/pwa/icon-192.png',
      badge: '/pwa/icon-192.png',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || '/#tab=home';

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of allClients) {
        if ('focus' in client) {
          // 이미 열린 탭이 있으면 그 탭으로 이동
          await client.focus();
          try {
            client.navigate(url);
          } catch {}
          return;
        }
      }
      // 없으면 새 창
      if (clients.openWindow) {
        await clients.openWindow(url);
      }
    })()
  );
});
