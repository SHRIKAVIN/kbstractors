import { useEffect, useState } from 'react';
import { Check, Copy, Eye, EyeOff, KeyRound, LogOut, Smartphone, Trash2 } from 'lucide-react';
import { BottomSheet } from '../rental/BottomSheet';
import { Toggle } from './Toggle';
import {
  ACCESS_SECTIONS,
  ACTION_LABEL,
  ALL_NOTIFICATIONS,
  NOTIFICATION_TYPES,
  SECTION_ACTIONS,
  isValidUsername,
  stripUsername,
  USERNAME_RULE,
  normalizeUsername,
  setAccessAction,
  type NotificationType,
  type UserAccess,
} from '../../lib/userAccess';
import {
  callUserControl,
  timeAgo,
  type AppUserRow,
  type SessionRow,
  type UserControlPayload,
} from '../../lib/userControlApi';

/** `null` = closed, `'new'` = add a login, otherwise edit that user. */
export type UserSheetTarget = null | 'new' | AppUserRow;

interface UserSheetProps {
  target: UserSheetTarget;
  sessions: SessionRow[];
  isSelf: (id: string) => boolean;
  onClose: () => void;
  onSaved: (payload: UserControlPayload, message: string) => void;
}

const DEFAULT_NEW_ACCESS: UserAccess = { tractor: ['read', 'create', 'collect'] };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 px-1 text-[12px] font-medium uppercase tracking-[0.14em] text-fog/40">{title}</h3>
      {children}
    </section>
  );
}

export function UserSheet({ target, sessions, isSelf, onClose, onSaved }: UserSheetProps) {
  const editing = target && target !== 'new' ? target : null;
  const creating = target === 'new';

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [access, setAccess] = useState<UserAccess>({});
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [loginEnabled, setLoginEnabled] = useState(true);
  const [stored, setStored] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<null | 'delete' | 'signout'>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!target) return;
    const row = target === 'new' ? null : target;
    setName(row?.name ?? '');
    setPhone(row?.phone ?? '');
    setUsername(row?.username ?? '');
    setPassword('');
    setShowPassword(false);
    setAccess(row ? row.access : DEFAULT_NEW_ACCESS);
    setNotifications(row ? row.notifications : ALL_NOTIFICATIONS);
    setLoginEnabled(row?.loginEnabled ?? true);
    setStored(undefined);
    setBusy(null);
    setError('');
    setConfirm(null);
  }, [target]);

  const userSessions = editing ? sessions.filter((s) => s.userId === editing.id) : [];
  const owner = editing?.isOwner ?? false;

  const run = async (key: string, action: string, payload: Record<string, unknown>, message: string, close = true) => {
    setBusy(key);
    setError('');
    try {
      const result = await callUserControl<UserControlPayload>(action, payload);
      onSaved(result, message);
      if (close) onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  };

  const save = () => {
    const cleanUsername = normalizeUsername(username);
    if (!name.trim()) return setError('Enter a name.');
    if (!isValidUsername(cleanUsername)) return setError(USERNAME_RULE);
    if (creating && password.trim().length < 6) return setError('Password must be at least 6 characters.');
    if (!creating && password && password.trim().length < 6) return setError('Password must be at least 6 characters.');
    const payload = {
      name,
      phone,
      username: cleanUsername,
      password: password || undefined,
      access,
      notifications,
      ...(editing ? { id: editing.id, loginEnabled } : {}),
    };
    void run('save', creating ? 'createUser' : 'updateUser', payload, creating ? `Added ${name.trim()}` : `Saved ${name.trim()}`);
  };

  const reveal = async () => {
    if (!editing) return;
    if (stored !== undefined) {
      setStored(undefined);
      return;
    }
    setBusy('reveal');
    try {
      const { password: value } = await callUserControl<{ password: string | null }>('revealPassword', { id: editing.id });
      setStored(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the password.');
    } finally {
      setBusy(null);
    }
  };

  const toggleNotification = (id: NotificationType, on: boolean) =>
    setNotifications((prev) => (on ? [...new Set([...prev, id])] : prev.filter((n) => n !== id)));

  return (
    <BottomSheet
      open={!!target}
      onClose={onClose}
      title={creating ? 'Add login' : editing?.name}
      subtitle={creating ? 'New user for KBS Tractors' : `@${editing?.username}${owner ? ' · Owner' : ''}`}
      footer={
        <button
          type="button"
          data-testid="user-save-button"
          onClick={save}
          disabled={busy !== null}
          className="kbs-press flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-[15px] font-semibold text-brand-fg disabled:opacity-60"
        >
          {busy === 'save' ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-fg/30 border-t-brand-fg" />
          ) : creating ? (
            'Create login'
          ) : (
            'Save changes'
          )}
        </button>
      }
    >
      <div className="space-y-6 pb-2">
        {error && (
          <p className="rounded-2xl bg-coral-500/10 px-4 py-3 text-[13.5px] font-medium text-coral-300 ring-1 ring-inset ring-coral-500/25">{error}</p>
        )}

        <Section title="Profile">
          <div className="space-y-3">
            <div>
              <label className="kbs-label" htmlFor="uc-name">Name</label>
              <input id="uc-name" className="kbs-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="kbs-label" htmlFor="uc-username">Username</label>
                <input
                  id="uc-username"
                  className="kbs-field"
                  value={username}
                  onChange={(e) => setUsername(stripUsername(e.target.value))}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="username"
                />
              </div>
              <div>
                <label className="kbs-label" htmlFor="uc-phone">Phone</label>
                <input id="uc-phone" className="kbs-field" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
              </div>
            </div>
          </div>
        </Section>

        <Section title="Password">
          <div className="space-y-3">
            <div className="kbs-field flex items-center gap-2">
              <KeyRound className="h-4 w-4 shrink-0 text-fog/35" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full bg-transparent outline-none placeholder:text-fog/30"
                placeholder={creating ? 'At least 6 characters' : 'New password (leave blank to keep)'}
              />
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="text-fog/40" aria-label="Show password">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {editing && (
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-line/[0.03] px-4 py-3 ring-1 ring-inset ring-line/[0.06]">
                <div className="min-w-0">
                  <p className="text-[13px] text-fog/55">Current password</p>
                  <p className="mt-0.5 truncate font-mono text-[15px]">
                    {stored === undefined ? '••••••••' : stored ?? <span className="font-app text-[13px] text-fog/45">Not stored — set a new one</span>}
                  </p>
                  {editing.passwordSetAt && (
                    <p className="mt-0.5 text-[11.5px] text-fog/35">
                      Set {timeAgo(editing.passwordSetAt)}
                      {editing.passwordSetBy ? ` by ${editing.passwordSetBy}` : ''}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {stored && (
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(stored);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      }}
                      className="kbs-press grid h-9 w-9 place-items-center rounded-full bg-line/[0.06] text-fog/70"
                      aria-label="Copy password"
                    >
                      {copied ? <Check className="h-4 w-4 text-pos" /> : <Copy className="h-4 w-4" />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void reveal()}
                    disabled={!editing.hasStoredPassword || busy === 'reveal'}
                    className="kbs-press h-9 rounded-full bg-line/[0.06] px-3.5 text-[13px] font-medium text-fog/75 disabled:opacity-40"
                  >
                    {busy === 'reveal' ? '…' : stored !== undefined ? 'Hide' : 'Reveal'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Section>

        {editing && !owner && (
          <div className="flex items-center justify-between gap-4 rounded-2xl bg-line/[0.03] px-4 py-3.5 ring-1 ring-inset ring-line/[0.06]">
            <div>
              <p className="text-[14.5px] font-medium">Login enabled</p>
              <p className="mt-0.5 text-[12.5px] text-fog/45">Off signs them out everywhere and blocks sign-in.</p>
            </div>
            <Toggle checked={loginEnabled} onChange={setLoginEnabled} label="Login enabled" />
          </div>
        )}

        <Section title="Access">
          {owner ? (
            <p className="rounded-2xl bg-pos/10 px-4 py-3 text-[13.5px] text-pos ring-1 ring-inset ring-pos/20">
              Owner — full access to everything, always.
            </p>
          ) : (
            <div className="space-y-3">
              {ACCESS_SECTIONS.map((section) => (
                <div key={section.id} className="rounded-2xl bg-line/[0.03] p-3.5 ring-1 ring-inset ring-line/[0.06]">
                  <p className="mb-2.5 text-[14px] font-semibold">{section.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {SECTION_ACTIONS[section.id].map((action) => {
                      const on = access[section.id]?.includes(action) ?? false;
                      return (
                        <button
                          key={action}
                          type="button"
                          data-testid={`access-${section.id}-${action}`}
                          onClick={() => setAccess((prev) => setAccessAction(prev, section.id, action, !on))}
                          className={`kbs-press inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium ring-1 ring-inset ${
                            on ? 'bg-brand text-brand-fg ring-brand' : 'bg-line/[0.03] text-fog/60 ring-line/10'
                          }`}
                        >
                          {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                          {ACTION_LABEL[action]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Notifications">
          <div className="divide-y divide-line/[0.06] rounded-2xl bg-line/[0.03] ring-1 ring-inset ring-line/[0.06]">
            {NOTIFICATION_TYPES.map((n) => (
              <div key={n.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-medium">{n.label}</p>
                  <p className="mt-0.5 text-[12px] text-fog/45">{n.help}</p>
                </div>
                <Toggle
                  checked={notifications.includes(n.id)}
                  onChange={(on) => toggleNotification(n.id, on)}
                  label={n.label}
                />
              </div>
            ))}
          </div>
        </Section>

        {editing && (
          <Section title={`Signed-in devices · ${userSessions.length}`}>
            {userSessions.length === 0 ? (
              <p className="px-1 text-[13px] text-fog/40">Not signed in anywhere. Last sign-in {timeAgo(editing.lastSignInAt)}.</p>
            ) : (
              <div className="space-y-2">
                {userSessions.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 rounded-2xl bg-line/[0.03] px-3.5 py-3 ring-1 ring-inset ring-line/[0.06]">
                    <Smartphone className="h-[18px] w-[18px] shrink-0 text-fog/40" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium">{s.deviceLabel}</p>
                      <p className="truncate text-[12px] text-fog/40">
                        Active {timeAgo(s.lastSeenAt)}
                        {s.ip ? ` · ${s.ip}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void run(`rev-${s.id}`, 'revokeSession', { sessionId: s.id, userName: editing.name }, 'Device signed out', false)}
                      disabled={busy !== null}
                      className="kbs-press h-8 shrink-0 rounded-full bg-line/[0.06] px-3 text-[12.5px] font-medium text-coral-300 disabled:opacity-40"
                    >
                      {busy === `rev-${s.id}` ? '…' : 'Sign out'}
                    </button>
                  </div>
                ))}
                {!isSelf(editing.id) && userSessions.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      confirm === 'signout'
                        ? void run('signout', 'revokeAllSessions', { id: editing.id }, `${editing.name} signed out everywhere`, false)
                        : setConfirm('signout')
                    }
                    disabled={busy !== null}
                    className="kbs-press flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-[13.5px] font-medium text-coral-300 ring-1 ring-inset ring-coral-500/25"
                  >
                    <LogOut className="h-4 w-4" />
                    {confirm === 'signout' ? 'Tap again to sign out everywhere' : 'Sign out of all devices'}
                  </button>
                )}
              </div>
            )}
          </Section>
        )}

        {editing && !owner && (
          <button
            type="button"
            data-testid="user-delete-button"
            onClick={() =>
              confirm === 'delete'
                ? void run('delete', 'deleteUser', { id: editing.id }, `Deleted ${editing.name}`)
                : setConfirm('delete')
            }
            disabled={busy !== null}
            className={`kbs-press flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-semibold ${
              confirm === 'delete' ? 'bg-coral-500 text-white' : 'bg-coral-500/10 text-coral-300 ring-1 ring-inset ring-coral-500/25'
            }`}
          >
            {busy === 'delete' ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                {confirm === 'delete' ? `Tap again to delete ${editing.name}` : 'Delete login'}
              </>
            )}
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
