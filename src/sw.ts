/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  new NavigationRoute(new NetworkFirst({ cacheName: 'pages' }), { denylist: [/^\/api/] }),
);

type PushPayload = {
  id?: string;
  title?: string;
  body?: string;
  url?: string;
};

self.addEventListener('push', (event) => {
  let payload: PushPayload = {};
  try {
    payload = event.data ? (event.data.json() as PushPayload) : {};
  } catch {
    payload = { body: event.data?.text() ?? '' };
  }
  const title = payload.title ?? 'KBS Tractors';
  const body = payload.body ?? '';
  const url = payload.url ?? '/';
  const tag = payload.id ? `kbs-push-${payload.id}` : `kbs-push-${Date.now()}`;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/kbs-tractors-192.png',
      badge: '/icons/kbs-tractors-192.png',
      tag,
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          void client.focus();
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});

export {};
