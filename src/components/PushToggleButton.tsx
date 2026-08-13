import { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { requestNotificationPermission } from '../lib/notifications';
import { getPushSetupStatus, registerWebPushSubscription, sendTestBackgroundPush, webPushSupported, vapidConfigured, type PushSetupStatus } from '../lib/webPush';

interface PushToggleButtonProps {
  /** Extra classes for positioning — e.g. "absolute top-0 left-0" in a header. */
  className?: string;
}

/**
 * Small header button to opt this device in to Web Push notifications
 * (new/updated/deleted entries, pending-payment reminders). Self-contained —
 * drop it into any header, it reads the logged-in admin from useAuth().
 *
 * Always asks for OS notification permission on click (never silently
 * disabled) — even when VAPID isn't configured yet, the permission prompt
 * still fires so the button never looks broken; it just explains what's
 * still missing afterward.
 */
export function PushToggleButton({ className = '' }: PushToggleButtonProps) {
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
    if (!user || busy || status === 'loading') return;
    setBusy(true);
    try {
      if (status === 'ready') {
        const result = await sendTestBackgroundPush();
        alert(result.message);
        return;
      }
      const permission = await requestNotificationPermission();
      if (permission !== 'granted') {
        alert('Notification permission was not granted.');
        return;
      }
      if (!webPushSupported()) {
        alert(
          vapidConfigured()
            ? 'Notifications allowed, but this browser/device does not support background push.'
            : 'Notifications allowed, but background push is not configured on this deployment yet (missing VITE_VAPID_PUBLIC_KEY).',
        );
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
  const label = ready ? 'Push on — tap to send a test' : 'Enable push notifications';

  return (
    <button
      type="button"
      data-testid="push-toggle-button"
      onClick={handleClick}
      disabled={busy || status === 'loading'}
      className={`text-white bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-all duration-200 transform hover:scale-110 hover:shadow-lg backdrop-blur-md border border-white/20 disabled:opacity-70 disabled:hover:scale-100 ${className}`}
      aria-label={label}
      title={label}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}
