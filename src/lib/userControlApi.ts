import { supabase } from './supabase';
import type { NotificationSettings, NotificationType, UserAccess } from './userAccess';

/** POST an action to /api/user-control with the signed-in user's token. */
export async function callUserControl<T = unknown>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not signed in.');
  const response = await fetch('/api/user-control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, ...payload }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error || `Request failed (${response.status})`);
  return result as T;
}

/** Fire-and-forget sign-in / sign-out record (audit log + "signed in" notification). */
export function recordSessionEvent(event: 'login' | 'logout'): Promise<void> {
  return callUserControl('recordSession', { event }).then(
    () => undefined,
    (err) => console.warn(`Could not record ${event}:`, err),
  );
}

// Mirrors server/userControl.ts (that file uses node:crypto, so the browser can't import it).

export type AppUserRow = {
  id: string;
  username: string;
  name: string;
  phone: string | null;
  isOwner: boolean;
  loginEnabled: boolean;
  access: UserAccess;
  notifications: NotificationType[];
  hasStoredPassword: boolean;
  passwordSetAt: string | null;
  passwordSetBy: string | null;
  lastSignInAt: string | null;
  createdAt: string;
};

export type SessionRow = {
  id: string;
  userId: string;
  userName: string;
  deviceLabel: string;
  ip: string | null;
  createdAt: string;
  lastSeenAt: string;
};

export type AuditRow = {
  id: string;
  actorName: string;
  action: string;
  targetName: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
};

export type UserControlPayload = {
  users: AppUserRow[];
  sessions: SessionRow[];
  settings: NotificationSettings;
  audit: AuditRow[];
};

/** "just now", "5 min ago", "3 h ago", "2 d ago", then a date. */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
