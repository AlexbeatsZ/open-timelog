// Installed app shells remain available when the network is unavailable.
const PREFIX = `open-timelog-${new URL(self.registration.scope).pathname}-`;
const CACHE = PREFIX + 'v0.1.0';
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const response = await fetch('./', { cache: 'reload' });
      if (!response.ok) throw new Error('App shell unavailable');
      const html = await response.clone().text();
      const assets = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^\"]+)"/g)].map(
        (match) => match[1],
      );
      await cache.put('./', response);
      await cache.addAll([
        './icon.svg',
        './manifest.webmanifest',
        './icon-192.png',
        './icon-512.png',
        ...assets,
      ]);
    })(),
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await Promise.all(
        (await caches.keys())
          .filter((key) => key.startsWith(PREFIX) && key !== CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin)
    return;
  event.respondWith(
    (async () => {
      // Same-origin app assets are immutable; a static host's Vary: Origin
      // must not prevent navigation/module requests from hitting this cache.
      const cache = await caches.open(CACHE);
      const cached = await cache.match(event.request, { ignoreVary: true });
      if (cached) return cached;
      try {
        return await fetch(event.request);
      } catch (error) {
        if (event.request.mode === 'navigate')
          return (await cache.match('./', { ignoreVary: true })) || Response.error();
        throw error;
      }
    })(),
  );
});
