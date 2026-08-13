export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return 'denied';
  return Notification.requestPermission();
}

/** Show a notification via the service worker when available (works in PWA background). */
export async function notifyPush(title: string, body: string) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  const options: NotificationOptions = {
    body,
    icon: '/icons/kbs-tractors-192.png',
    badge: '/icons/kbs-tractors-192.png',
    tag: `kbs-${Date.now()}`,
  };
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, options);
      return;
    }
    new Notification(title, options);
  } catch {
    try {
      new Notification(title, options);
    } catch {
      /* no-op */
    }
  }
}
