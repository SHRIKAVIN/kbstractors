import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  ALL_NOTIFICATIONS,
  FULL_ACCESS,
  NOTIFICATION_SETTINGS_KEY,
  USERNAME_RULE,
  isValidUsername,
  normalizeUsername,
  parseDeviceLabel,
  resolveNotificationSettings,
  sanitizeAccess,
  sanitizeNotifications,
  type NotificationSettings,
  type NotificationType,
  type UserAccess,
} from '../src/lib/userAccess.js';
import { loadNotificationSettings } from './push.js';

// Logins created here never see their email — they sign in with a username,
// which the login form resolves to this address.
const EMAIL_DOMAIN = 'kbstractors.app';
const BAN_FOREVER = '876000h';

export class UserControlError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

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

type Actor = { id: string; name: string };

type DbUser = {
  id: string;
  username: string;
  name: string;
  phone: string | null;
  is_owner: boolean;
  login_enabled: boolean;
  access: unknown;
  notifications: unknown;
  created_at: string;
};
type DbSecret = { user_id: string; password_cipher: string | null; password_set_at: string | null; password_set_by: string | null };
type DbSession = { id: string; user_id: string; created_at: string; last_seen_at: string | null; user_agent: string | null; ip: string | null };
type DbAudit = {
  id: string;
  actor_name: string;
  action: string;
  target_name: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

// ── Password sealing (AES-256-GCM, same format as finance_manager) ──────────

function credsSecret(): string {
  const secret = (process.env.STAFF_CREDS_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!secret) throw new UserControlError('STAFF_CREDS_SECRET is not set.', 500);
  return secret;
}

function key(): Buffer {
  return createHash('sha256').update(credsSecret()).digest();
}

export function sealPassword(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
}

function openPassword(sealed: string): string {
  const [version, iv, tag, data] = sealed.split('.');
  if (version !== 'v1' || !iv || !tag || !data) throw new UserControlError('Stored password is unreadable.', 500);
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}

// ── Guards ──────────────────────────────────────────────────────────────────

export async function userFromBearer(admin: SupabaseClient, authorization: string | undefined): Promise<User> {
  const token = authorization?.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new UserControlError('Unauthorized', 401);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new UserControlError('Unauthorized', 401);
  return data.user;
}

/** User control is a person gate: only the owner login, and only while enabled. */
export async function requireOwner(admin: SupabaseClient, authUser: User): Promise<Actor> {
  const { data } = await admin
    .from('app_users')
    .select('id, name, is_owner, login_enabled')
    .eq('id', authUser.id)
    .maybeSingle();
  if (!data?.is_owner || !data.login_enabled) {
    throw new UserControlError('User control is only available to the owner account.', 403);
  }
  return { id: data.id, name: data.name };
}

async function audit(
  admin: SupabaseClient,
  actor: Actor,
  action: string,
  target: { id?: string | null; name?: string | null } | null,
  details?: Record<string, unknown>,
) {
  const { error } = await admin.from('audit_log').insert({
    actor_id: actor.id,
    actor_name: actor.name,
    action,
    target_id: target?.id ?? null,
    target_name: target?.name ?? null,
    details: details ?? null,
  });
  if (error) console.warn('Audit write failed:', error.message);
}

// ── Reads ───────────────────────────────────────────────────────────────────

async function listAuthUsers(admin: SupabaseClient): Promise<Map<string, User>> {
  const out = new Map<string, User>();
  for (let page = 1; page < 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new UserControlError(error.message, 500);
    for (const u of data.users) out.set(u.id, u);
    if (data.users.length < 200) break;
  }
  return out;
}

export async function loadUserControl(admin: SupabaseClient): Promise<UserControlPayload> {
  const [usersRes, secretsRes, sessionsRes, auditRes, authUsers, settings] = await Promise.all([
    admin.from('app_users').select('*').order('created_at', { ascending: true }),
    admin.from('app_user_secrets').select('user_id, password_cipher, password_set_at, password_set_by'),
    admin.rpc('admin_list_sessions'),
    admin.from('audit_log').select('*').order('created_at', { ascending: false }).limit(50),
    listAuthUsers(admin),
    loadNotificationSettings(admin),
  ]);
  if (usersRes.error) throw new UserControlError(usersRes.error.message, 500);

  const secrets = new Map(((secretsRes.data ?? []) as DbSecret[]).map((s) => [s.user_id, s]));
  const users: AppUserRow[] = ((usersRes.data ?? []) as DbUser[]).map((u) => {
    const secret = secrets.get(u.id);
    return {
      id: u.id,
      username: u.username,
      name: u.name,
      phone: u.phone,
      isOwner: u.is_owner,
      loginEnabled: u.login_enabled,
      access: u.is_owner ? FULL_ACCESS : sanitizeAccess(u.access),
      notifications: sanitizeNotifications(u.notifications),
      hasStoredPassword: Boolean(secret?.password_cipher),
      passwordSetAt: secret?.password_set_at ?? null,
      passwordSetBy: secret?.password_set_by ?? null,
      lastSignInAt: authUsers.get(u.id)?.last_sign_in_at ?? null,
      createdAt: u.created_at,
    };
  });
  // Owner first, then by name.
  users.sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || a.name.localeCompare(b.name));

  const names = new Map(users.map((u) => [u.id, u.name]));
  const sessions: SessionRow[] = ((sessionsRes.data ?? []) as DbSession[])
    .filter((s) => names.has(s.user_id))
    .map((s) => ({
      id: s.id,
      userId: s.user_id,
      userName: names.get(s.user_id) ?? 'Unknown',
      deviceLabel: parseDeviceLabel(s.user_agent),
      ip: s.ip ?? null,
      createdAt: s.created_at,
      lastSeenAt: s.last_seen_at ?? s.created_at,
    }))
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));

  const auditRows: AuditRow[] = ((auditRes.data ?? []) as DbAudit[]).map((a) => ({
    id: a.id,
    actorName: a.actor_name,
    action: a.action,
    targetName: a.target_name,
    details: a.details,
    createdAt: a.created_at,
  }));

  return { users, sessions, settings, audit: auditRows };
}

async function getAppUser(admin: SupabaseClient, id: string) {
  const { data, error } = await admin.from('app_users').select('*').eq('id', id).maybeSingle();
  if (error) throw new UserControlError(error.message, 500);
  if (!data) throw new UserControlError('User not found.', 404);
  return data as DbUser;
}

async function assertUsernameFree(admin: SupabaseClient, username: string, exceptId?: string) {
  const { data } = await admin.from('app_users').select('id').eq('username', username).maybeSingle();
  if (data && data.id !== exceptId) throw new UserControlError('That username is already in use.');
}

function checkPassword(password: string) {
  if (password.length < 6) throw new UserControlError('Password must be at least 6 characters.');
}

async function storePassword(admin: SupabaseClient, userId: string, password: string, actor: Actor) {
  const { error } = await admin.from('app_user_secrets').upsert({
    user_id: userId,
    password_cipher: sealPassword(password),
    password_set_at: new Date().toISOString(),
    password_set_by: actor.name,
  });
  if (error) throw new UserControlError(error.message, 500);
}

async function revokeAllFor(admin: SupabaseClient, userId: string) {
  const { error } = await admin.rpc('admin_revoke_user_sessions', { p_user: userId });
  if (error) throw new UserControlError(error.message, 500);
}

// ── Writes ──────────────────────────────────────────────────────────────────

export async function createUser(
  admin: SupabaseClient,
  actor: Actor,
  input: { name?: string; phone?: string; username?: string; password?: string; access?: unknown; notifications?: unknown },
) {
  const name = input.name?.trim() ?? '';
  const username = normalizeUsername(input.username ?? '');
  const password = input.password?.trim() ?? '';
  if (!name) throw new UserControlError('Name is required.');
  if (!isValidUsername(username)) {
    throw new UserControlError(USERNAME_RULE);
  }
  checkPassword(password);
  await assertUsernameFree(admin, username);

  const email = `${username}.${randomUUID().slice(0, 6)}@${EMAIL_DOMAIN}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new UserControlError(error?.message ?? 'Could not create the login.', 500);

  const { error: rowErr } = await admin.from('app_users').insert({
    id: data.user.id,
    username,
    name,
    phone: input.phone?.trim() || null,
    access: sanitizeAccess(input.access),
    notifications: input.notifications === undefined ? ALL_NOTIFICATIONS : sanitizeNotifications(input.notifications),
  });
  if (rowErr) {
    await admin.auth.admin.deleteUser(data.user.id);
    throw new UserControlError(rowErr.message, 500);
  }
  await storePassword(admin, data.user.id, password, actor);
  await audit(admin, actor, 'CREATE', { id: data.user.id, name }, { username });
}

export async function updateUser(
  admin: SupabaseClient,
  actor: Actor,
  input: {
    id?: string;
    name?: string;
    phone?: string;
    username?: string;
    password?: string;
    loginEnabled?: boolean;
    access?: unknown;
    notifications?: unknown;
  },
) {
  if (!input.id) throw new UserControlError('User id is required.');
  const user = await getAppUser(admin, input.id);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const changes: Record<string, unknown> = {};

  if (input.name !== undefined) {
    if (!input.name.trim()) throw new UserControlError('Name is required.');
    patch.name = input.name.trim();
  }
  if (input.phone !== undefined) patch.phone = input.phone.trim() || null;
  if (input.username !== undefined) {
    const username = normalizeUsername(input.username);
    if (!isValidUsername(username)) {
      throw new UserControlError(USERNAME_RULE);
    }
    if (username !== user.username) {
      await assertUsernameFree(admin, username, user.id);
      patch.username = username;
      changes.username = username;
    }
  }
  if (input.access !== undefined && !user.is_owner) {
    patch.access = sanitizeAccess(input.access);
    changes.access = patch.access;
  }
  if (input.notifications !== undefined) {
    patch.notifications = sanitizeNotifications(input.notifications);
    changes.notifications = patch.notifications;
  }

  const password = input.password?.trim() ?? '';
  if (password) {
    checkPassword(password);
    const { error } = await admin.auth.admin.updateUserById(user.id, { password });
    if (error) throw new UserControlError(error.message, 500);
    await storePassword(admin, user.id, password, actor);
    changes.passwordChanged = true;
  }

  if (input.loginEnabled !== undefined && input.loginEnabled !== user.login_enabled) {
    if (user.is_owner && !input.loginEnabled) throw new UserControlError('You cannot disable the owner login.');
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      ban_duration: input.loginEnabled ? 'none' : BAN_FOREVER,
    });
    if (error) throw new UserControlError(error.message, 500);
    patch.login_enabled = input.loginEnabled;
    changes.loginEnabled = input.loginEnabled;
    if (!input.loginEnabled) await revokeAllFor(admin, user.id);
  }

  const { error } = await admin.from('app_users').update(patch).eq('id', user.id);
  if (error) throw new UserControlError(error.message, 500);
  await audit(admin, actor, 'UPDATE', { id: user.id, name: (patch.name as string) ?? user.name }, changes);
}

export async function deleteUser(admin: SupabaseClient, actor: Actor, id: string | undefined) {
  if (!id) throw new UserControlError('User id is required.');
  const user = await getAppUser(admin, id);
  if (user.is_owner) throw new UserControlError('You cannot delete the owner login.');
  await revokeAllFor(admin, user.id);
  // Cascades to app_users, app_user_secrets and push_subscriptions.
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error && !/not found/i.test(error.message)) throw new UserControlError(error.message, 500);
  await admin.from('app_users').delete().eq('id', user.id);
  await audit(admin, actor, 'DELETE', { id: user.id, name: user.name }, { username: user.username });
}

export async function revealPassword(admin: SupabaseClient, actor: Actor, id: string | undefined): Promise<string | null> {
  if (!id) throw new UserControlError('User id is required.');
  const user = await getAppUser(admin, id);
  const { data } = await admin.from('app_user_secrets').select('password_cipher').eq('user_id', id).maybeSingle();
  await audit(admin, actor, 'REVEAL_PASSWORD', { id, name: user.name });
  return data?.password_cipher ? openPassword(data.password_cipher) : null;
}

export async function revokeSession(admin: SupabaseClient, actor: Actor, sessionId: string | undefined, userName?: string) {
  if (!sessionId) throw new UserControlError('Session id is required.');
  const { error } = await admin.rpc('admin_revoke_session', { p_session: sessionId });
  if (error) throw new UserControlError(error.message, 500);
  await audit(admin, actor, 'REVOKE_SESSION', { name: userName ?? null }, { sessionId });
}

export async function revokeAllSessions(admin: SupabaseClient, actor: Actor, id: string | undefined) {
  if (!id) throw new UserControlError('User id is required.');
  const user = await getAppUser(admin, id);
  await revokeAllFor(admin, id);
  await audit(admin, actor, 'REVOKE_ALL_SESSIONS', { id, name: user.name });
}

export async function saveSettings(admin: SupabaseClient, actor: Actor, input: unknown) {
  const settings = resolveNotificationSettings(input);
  const { error } = await admin
    .from('app_settings')
    .upsert({ key: NOTIFICATION_SETTINGS_KEY, value: settings, updated_at: new Date().toISOString() });
  if (error) throw new UserControlError(error.message, 500);
  await audit(admin, actor, 'NOTIFICATION_SETTINGS', null, { ...settings });
}

/**
 * Any signed-in user: log their own sign-in / sign-out and send the
 * "signed in / out" notification (to everyone who has that switch on, except
 * the user themselves).
 */
export async function recordSession(
  admin: SupabaseClient,
  authUser: User,
  event: unknown,
  userAgent: string | undefined,
) {
  if (event !== 'login' && event !== 'logout') throw new UserControlError('Unknown session event.');
  const { data: me } = await admin.from('app_users').select('id, name').eq('id', authUser.id).maybeSingle();
  if (!me) return;
  const device = parseDeviceLabel(userAgent);
  const verb = event === 'login' ? 'signed in' : 'signed out';
  await audit(admin, { id: me.id, name: me.name }, event === 'login' ? 'LOGIN' : 'LOGOUT', { id: me.id, name: me.name }, { device });
  const { error } = await admin.from('app_notifications').insert({
    actor_name: me.name,
    actor_id: me.id,
    title: `${me.name} ${verb}`,
    body: `${me.name} ${verb} on ${device}`,
    kind: `session_${event}`,
  });
  if (error) console.warn('Session notification insert failed:', error.message);
}
