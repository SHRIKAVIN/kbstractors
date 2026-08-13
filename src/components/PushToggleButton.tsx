import { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { requestNotificationPermission } from '../lib/notifications';
import { getPushSetupStatus, registerWebPushSubscription, type PushSetupStatus } from '../lib/webPush';

/**
 * Small header button to opt this device in to Web Push notifications
 * (new/updated/deleted entries, pending-payment reminders). Self-contained —
 * drop it into any header, it reads the logged-in admin from useAuth().
 */
export function PushToggleButton() {
  const { user } = useAuth();
  const [status, setStatus] = useState<PushSetupStatus | 'loading'>('loading');
  const [busy, setBusy] = useState(false);

  const refreshStatus = useCallback(async () => {
    if (!user) return;
    setStatus(await getPushSetupStatus(user.id));
  }, [user]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const handleClick = async () => {
    if (!user || busy || status === 'ready') return;
    setBusy(true);
    try {
      if (status === 'needs_vapid') {
        alert('Push notifications are not configured on this deployment yet.');
        return;
      }
      const permission = await requestNotificationPermission();
      if (permission !== 'granted') {
        alert('Notification permission was not granted.');
        return;
      }
      await registerWebPushSubscription(user.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not enable push notifications.');
    } finally {
      setBusy(false);
      void refreshStatus();
    }
  };

  if (!user) return null;

  const ready = status === 'ready';
  const Icon = status === 'needs_vapid' ? BellOff : ready ? BellRing : Bell;
  const label = ready ? 'Push notifications enabled' : 'Enable push notifications';

  return (
    <button
      type="button"
      data-testid="push-toggle-button"
      onClick={handleClick}
      disabled={busy || status === 'loading' || status === 'needs_vapid'}
      className="flex-1 text-white p-2 sm:py-3 rounded-xl hover:bg-white/20 flex items-center justify-center transition-all duration-200 transform hover:scale-110 hover:shadow-lg disabled:opacity-60 disabled:hover:scale-100"
      aria-label={label}
      title={label}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}
