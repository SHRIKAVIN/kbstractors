// Per-user access + notification config, shared by the browser and the
// Vercel functions under api/ — keep it dependency-free.
//
// There are no roles: every login carries its own section permissions and its
// own notification choices. The owner (shrikavin) always has everything and
// is the only one who can open User control.

export const ACCESS_SECTIONS = [
  { id: 'tractor', label: 'Tractor rentals' },
  { id: 'jcb', label: 'JCB' },
] as const;

export type AccessSection = (typeof ACCESS_SECTIONS)[number]['id'];

export const ACCESS_ACTIONS = ['read', 'create', 'update', 'delete', 'collect'] as const;
export type AccessAction = (typeof ACCESS_ACTIONS)[number];

export const ACTION_LABEL: Record<AccessAction, string> = {
  read: 'View',
  create: 'Add',
  update: 'Edit',
  delete: 'Delete',
  collect: 'Collect',
};

/** Which actions make sense per section — JCB has no separate collect flow. */
export const SECTION_ACTIONS: Record<AccessSection, AccessAction[]> = {
  tractor: ['read', 'create', 'update', 'delete', 'collect'],
  jcb: ['read', 'create', 'update', 'delete'],
};

export type UserAccess = Partial<Record<AccessSection, AccessAction[]>>;

export const FULL_ACCESS: UserAccess = {
  tractor: [...SECTION_ACTIONS.tractor],
  jcb: [...SECTION_ACTIONS.jcb],
};

export const NOTIFICATION_TYPES = [
  { id: 'tractor', label: 'Tractor entries', help: 'Added, edited or deleted' },
  { id: 'collection', label: 'Collections', help: 'Payment collected or reduced on a tractor entry' },
  { id: 'jcb', label: 'JCB entries', help: 'Added, edited or deleted' },
  { id: 'reminders', label: 'Pending reminders', help: 'Daily digest of entries pending 10+ days' },
  { id: 'summary', label: 'Daily summary', help: "9:30 PM wrap-up: today's collections, new entries, pending" },
  { id: 'session', label: 'Sign in / sign out', help: 'When any user signs in or out' },
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]['id'];

export const ALL_NOTIFICATIONS: NotificationType[] = NOTIFICATION_TYPES.map((n) => n.id);

/** New logins start with everything except the business-wide daily summary (owner opts them in). */
export const DEFAULT_USER_NOTIFICATIONS: NotificationType[] = ALL_NOTIFICATIONS.filter((id) => id !== 'summary');

/** Maps an app_notifications.kind to the per-user notification switch that governs it. */
export function notificationTypeForKind(kind: string | null | undefined): NotificationType | null {
  if (!kind) return null;
  if (kind === 'rental_collected' || kind === 'rental_payment_reduced') return 'collection';
  if (kind === 'daily_summary') return 'summary';
  if (kind.startsWith('rental_')) return 'tractor';
  if (kind.startsWith('jcb_')) return 'jcb';
  if (kind === 'pending_digest') return 'reminders';
  if (kind.startsWith('session_')) return 'session';
  return null;
}

/** Business-wide master switches (app_settings row `notifications.global`). */
export interface NotificationSettings {
  /** Every push notification, for everyone. */
  push: boolean;
  /** The daily pending-payment digest. */
  reminders: boolean;
  /** The 9:30 PM daily summary. */
  summary: boolean;
}

export const NOTIFICATION_SETTINGS_KEY = 'notifications.global';

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = { push: true, reminders: true, summary: true };

/**
 * Anything missing or unreadable resolves to ON — a corrupted row must never
 * silently mute the whole business.
 */
export function resolveNotificationSettings(value: unknown): NotificationSettings {
  if (!value || typeof value !== 'object') return { ...DEFAULT_NOTIFICATION_SETTINGS };
  const v = value as Record<string, unknown>;
  return {
    push: typeof v.push === 'boolean' ? v.push : DEFAULT_NOTIFICATION_SETTINGS.push,
    reminders: typeof v.reminders === 'boolean' ? v.reminders : DEFAULT_NOTIFICATION_SETTINGS.reminders,
    summary: typeof v.summary === 'boolean' ? v.summary : DEFAULT_NOTIFICATION_SETTINGS.summary,
  };
}

/** Keeps only known sections/actions; `read` is implied by any other action. */
export function sanitizeAccess(value: unknown): UserAccess {
  if (!value || typeof value !== 'object') return {};
  const out: UserAccess = {};
  for (const { id } of ACCESS_SECTIONS) {
    const raw = (value as Record<string, unknown>)[id];
    if (!Array.isArray(raw)) continue;
    const allowed = new Set(SECTION_ACTIONS[id]);
    const picked = new Set(raw.filter((a): a is AccessAction => typeof a === 'string' && allowed.has(a as AccessAction)));
    if (picked.size && !picked.has('read')) picked.add('read');
    const list = SECTION_ACTIONS[id].filter((a) => picked.has(a));
    if (list.length) out[id] = list;
  }
  return out;
}

export function sanitizeNotifications(value: unknown): NotificationType[] {
  if (!Array.isArray(value)) return [];
  const known = new Set<string>(ALL_NOTIFICATIONS);
  return ALL_NOTIFICATIONS.filter((id) => value.includes(id) && known.has(id));
}

/** Toggle one action; turning off `read` clears the section, turning anything on adds `read`. */
export function setAccessAction(access: UserAccess, section: AccessSection, action: AccessAction, on: boolean): UserAccess {
  const current = new Set(access[section] ?? []);
  if (on) {
    current.add(action);
    current.add('read');
  } else if (action === 'read') {
    current.clear();
  } else {
    current.delete(action);
  }
  return sanitizeAccess({ ...access, [section]: [...current] });
}

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export const USERNAME_RULE = 'Username: 3–32 letters only (a–z). No spaces, numbers or symbols.';

/** Usernames are letters only and case-insensitive (always stored lowercase). */
export function isValidUsername(username: string): boolean {
  return /^[a-z]{3,32}$/.test(username);
}

/** Drops anything that isn't a letter — used while typing a username. */
export function stripUsername(raw: string): string {
  return raw.replace(/[^a-zA-Z]/g, '').toLowerCase().slice(0, 32);
}

/** Best-effort "Chrome on Android" style label for a User-Agent. */
export function parseDeviceLabel(userAgent: string | null | undefined): string {
  const ua = userAgent?.trim() ?? '';
  if (!ua) return 'Unknown device';
  const browser = ua.includes('Edg/')
    ? 'Edge'
    : ua.includes('Chrome/') && !ua.includes('Chromium')
      ? 'Chrome'
      : ua.includes('Firefox/')
        ? 'Firefox'
        : ua.includes('Safari/') && !ua.includes('Chrome/')
          ? 'Safari'
          : 'Browser';
  const device = /Android/i.test(ua)
    ? 'Android'
    : /iPhone|iPad|iPod/i.test(ua)
      ? 'iPhone'
      : /Macintosh|Mac OS X/i.test(ua)
        ? 'Mac'
        : /Windows/i.test(ua)
          ? 'Windows'
          : /Linux/i.test(ua)
            ? 'Linux'
            : 'device';
  return `${browser} on ${device}`;
}
