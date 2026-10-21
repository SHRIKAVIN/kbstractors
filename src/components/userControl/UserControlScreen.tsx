import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, BellOff, BellRing, Check, ChevronLeft, ChevronRight, RefreshCw, ShieldCheck, Smartphone, UserPlus } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { ACCESS_SECTIONS, ACTION_LABEL, type NotificationSettings } from '../../lib/userAccess';
import { callUserControl, timeAgo, type AppUserRow, type AuditRow, type UserControlPayload } from '../../lib/userControlApi';
import { initials } from '../rental/rentalDisplay';
import { Toggle } from './Toggle';
import { UserSheet, type UserSheetTarget } from './UserSheet';

interface UserControlScreenProps {
  onBack: () => void;
}

const SETTINGS_COPY: Record<keyof NotificationSettings, { label: string; help: string }> = {
  push: {
    label: 'All notifications',
    help: 'Master switch. Off silences every push, for every user, whatever their own settings say.',
  },
  summary: {
    label: 'Daily summary · 9:30 PM',
    help: "Today's collections, new entries and total pending.",
  },
  reminders: {
    label: 'Daily pending reminders',
    help: 'The morning digest of entries pending 10+ days.',
  },
};

function accessSummary(user: AppUserRow): string {
  if (user.isOwner) return 'Full access';
  const parts = ACCESS_SECTIONS.flatMap((section) => {
    const actions = user.access[section.id] ?? [];
    if (!actions.length) return [];
    const extra = actions.filter((a) => a !== 'read').map((a) => ACTION_LABEL[a].toLowerCase());
    return [`${section.id === 'tractor' ? 'Tractor' : 'JCB'}${extra.length ? ` (${extra.join(', ')})` : ' (view)'}`];
  });
  return parts.length ? parts.join(' · ') : 'No access';
}

function describeAudit(row: AuditRow): string {
  const target = row.targetName ?? '';
  switch (row.action) {
    case 'CREATE':
      return `added ${target}`;
    case 'UPDATE': {
      const d = row.details ?? {};
      const bits = [
        d.passwordChanged ? 'password' : null,
        'loginEnabled' in d ? (d.loginEnabled ? 'enabled login' : 'disabled login') : null,
        d.access ? 'access' : null,
        d.notifications ? 'notifications' : null,
        d.username ? 'username' : null,
      ].filter(Boolean);
      return `updated ${target}${bits.length ? ` — ${bits.join(', ')}` : ''}`;
    }
    case 'DELETE':
      return `deleted ${target}`;
    case 'REVEAL_PASSWORD':
      return `revealed ${target}'s password`;
    case 'REVOKE_SESSION':
      return `signed out a device${target ? ` of ${target}` : ''}`;
    case 'REVOKE_ALL_SESSIONS':
      return `signed ${target} out everywhere`;
    case 'NOTIFICATION_SETTINGS': {
      const d = row.details ?? {};
      if (d.push === false) return 'turned all notifications off';
      return `turned notifications on · summary ${d.summary === false ? 'off' : 'on'} · reminders ${d.reminders === false ? 'off' : 'on'}`;
    }
    case 'LOGIN':
      return `signed in${row.details?.device ? ` on ${row.details.device}` : ''}`;
    case 'LOGOUT':
      return `signed out${row.details?.device ? ` of ${row.details.device}` : ''}`;
    default:
      return row.action.toLowerCase();
  }
}

export function UserControlScreen({ onBack }: UserControlScreenProps) {
  const { user } = useAuth();
  const [data, setData] = useState<UserControlPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingSetting, setSavingSetting] = useState<keyof NotificationSettings | null>(null);
  const [sheet, setSheet] = useState<UserSheetTarget>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const showToast = (message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await callUserControl<UserControlPayload>('load'));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load User control.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    void load();
    // Keep "signed-in devices" fresh while the screen is open.
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void callUserControl<UserControlPayload>('load').then(setData, () => undefined);
      }
    }, 30_000);
    return () => clearInterval(timer);
  }, [load]);

  const toggleSetting = async (key: keyof NotificationSettings, value: boolean) => {
    if (!data) return;
    setSavingSetting(key);
    try {
      const next = await callUserControl<UserControlPayload>('saveSettings', { settings: { ...data.settings, [key]: value } });
      setData(next);
      showToast(`${SETTINGS_COPY[key].label} ${value ? 'on' : 'off'}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSavingSetting(null);
    }
  };

  const sessionsByUser = new Map<string, number>();
  for (const s of data?.sessions ?? []) sessionsByUser.set(s.userId, (sessionsByUser.get(s.userId) ?? 0) + 1);

  return (
    <div data-testid="user-control-screen" className="kbs-app kbs-grain relative min-h-screen overflow-x-clip pb-[calc(3rem+env(safe-area-inset-bottom))]">
      <div className="pointer-events-none absolute -left-32 -top-40 h-[380px] w-[380px] rounded-full bg-pos/[0.12] blur-[100px]" />

      <header className="sticky top-0 z-30 bg-night-950/75 pt-[calc(0.625rem+env(safe-area-inset-top))] backdrop-blur-2xl">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={onBack}
            className="kbs-press grid h-10 w-10 place-items-center rounded-full bg-line/[0.06] text-fog/80 ring-1 ring-inset ring-line/10"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-[17px] font-semibold tracking-tight">User control</h1>
            <p className="text-[12px] text-fog/45">Logins, access and notifications</p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="kbs-press grid h-10 w-10 place-items-center rounded-full bg-line/[0.06] text-fog/80 ring-1 ring-inset ring-line/10"
            aria-label="Refresh"
          >
            <RefreshCw className={`h-[18px] w-[18px] ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-3xl space-y-8 px-4 pt-4 sm:px-6">
        {error && (
          <div className="rounded-2xl bg-coral-500/10 px-4 py-3 text-[13.5px] text-coral-300 ring-1 ring-inset ring-coral-500/25">
            {error}
          </div>
        )}

        {!data && loading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="kbs-surface h-20 animate-pulse rounded-[24px]" />
            ))}
          </div>
        )}

        {data && (
          <>
            {/* Notifications */}
            <section className="animate-rise-in">
              <h2 className="mb-3 flex items-center gap-2 px-1 text-[12px] font-medium uppercase tracking-[0.14em] text-fog/40">
                Notifications
              </h2>
              <div
                className={`relative overflow-hidden rounded-[26px] p-5 ring-1 ring-inset transition-colors ${
                  data.settings.push ? 'bg-gradient-to-br from-pos/[0.14] via-night-850 to-night-850 ring-pos/20' : 'kbs-surface'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${data.settings.push ? 'bg-brand text-brand-fg' : 'bg-line/[0.06] text-fog/40'}`}>
                    {data.settings.push ? <BellRing className="h-6 w-6" /> : <BellOff className="h-6 w-6" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] font-semibold">{SETTINGS_COPY.push.label}</p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-fog/50">{SETTINGS_COPY.push.help}</p>
                  </div>
                  <Toggle
                    checked={data.settings.push}
                    onChange={(v) => void toggleSetting('push', v)}
                    disabled={savingSetting !== null}
                    label={SETTINGS_COPY.push.label}
                  />
                </div>
                {(['summary', 'reminders'] as const).map((key) => (
                  <div
                    key={key}
                    className={`mt-4 flex items-center justify-between gap-4 border-t border-line/[0.06] pt-4 ${data.settings.push ? '' : 'opacity-40'}`}
                  >
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium">{SETTINGS_COPY[key].label}</p>
                      <p className="mt-0.5 text-[12px] text-fog/45">{SETTINGS_COPY[key].help}</p>
                    </div>
                    <Toggle
                      checked={data.settings[key]}
                      onChange={(v) => void toggleSetting(key, v)}
                      disabled={savingSetting !== null || !data.settings.push}
                      label={SETTINGS_COPY[key].label}
                    />
                  </div>
                ))}
              </div>
            </section>

            {/* Users */}
            <section className="animate-rise-in" style={{ animationDelay: '60ms' }}>
              <div className="mb-3 flex items-center justify-between px-1">
                <h2 className="text-[12px] font-medium uppercase tracking-[0.14em] text-fog/40">Users · {data.users.length}</h2>
                <button
                  type="button"
                  data-testid="add-user-button"
                  onClick={() => setSheet('new')}
                  className="kbs-press inline-flex h-9 items-center gap-1.5 rounded-full bg-brand px-3.5 text-[13px] font-semibold text-brand-fg"
                >
                  <UserPlus className="h-4 w-4" />
                  Add login
                </button>
              </div>
              <div className="space-y-2.5">
                {data.users.map((u) => {
                  const live = sessionsByUser.get(u.id) ?? 0;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      data-testid={`user-row-${u.username}`}
                      onClick={() => setSheet(u)}
                      className="kbs-surface kbs-press flex w-full items-center gap-3.5 rounded-[24px] px-4 py-3.5 text-left"
                    >
                      <div className="relative">
                        <div
                          className={`grid h-12 w-12 place-items-center rounded-2xl text-[17px] font-semibold ${
                            u.loginEnabled ? 'bg-brand/15 text-pos' : 'bg-line/[0.06] text-fog/35'
                          }`}
                        >
                          {initials(u.name)}
                        </div>
                        {live > 0 && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-pos ring-[3px] ring-night-850" title="Signed in" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className={`truncate text-[15.5px] font-semibold ${u.loginEnabled ? '' : 'text-fog/45 line-through'}`}>{u.name}</p>
                          {u.isOwner && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-pos/10 px-2 py-0.5 text-[11px] font-semibold text-pos">
                              <ShieldCheck className="h-3 w-3" />
                              Owner
                            </span>
                          )}
                          {!u.loginEnabled && (
                            <span className="shrink-0 rounded-full bg-coral-500/10 px-2 py-0.5 text-[11px] font-semibold text-coral-300">Disabled</span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-[12.5px] text-fog/45">
                          @{u.username} · {accessSummary(u)}
                        </p>
                        <p className="mt-0.5 truncate text-[11.5px] text-fog/35">
                          {live > 0 ? `${live} device${live > 1 ? 's' : ''} signed in` : `Last sign-in ${timeAgo(u.lastSignInAt)}`}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-fog/25" />
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Devices */}
            <section className="animate-rise-in" style={{ animationDelay: '120ms' }}>
              <h2 className="mb-3 px-1 text-[12px] font-medium uppercase tracking-[0.14em] text-fog/40">
                Signed-in devices · {data.sessions.length}
              </h2>
              {data.sessions.length === 0 ? (
                <p className="px-1 text-[13px] text-fog/40">No one is signed in.</p>
              ) : (
                <div className="kbs-surface divide-y divide-line/[0.06] overflow-hidden rounded-[24px]">
                  {data.sessions.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                      <Smartphone className="h-[18px] w-[18px] shrink-0 text-fog/35" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium">
                          {s.userName} <span className="font-normal text-fog/45">· {s.deviceLabel}</span>
                        </p>
                        <p className="truncate text-[12px] text-fog/40">
                          Active {timeAgo(s.lastSeenAt)} · signed in {timeAgo(s.createdAt)}
                          {s.ip ? ` · ${s.ip}` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Activity */}
            <section className="animate-rise-in" style={{ animationDelay: '180ms' }}>
              <h2 className="mb-3 flex items-center gap-2 px-1 text-[12px] font-medium uppercase tracking-[0.14em] text-fog/40">
                <Activity className="h-3.5 w-3.5" />
                Activity
              </h2>
              {data.audit.length === 0 ? (
                <p className="px-1 text-[13px] text-fog/40">Nothing yet.</p>
              ) : (
                <ol className="relative space-y-4 pl-5 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-line/10">
                  {data.audit.map((a) => (
                    <li key={a.id} className="relative">
                      <span className="absolute -left-5 top-1.5 h-[11px] w-[11px] rounded-full bg-night-950 ring-2 ring-pos/50" />
                      <p className="text-[13.5px]">
                        <span className="font-semibold">{a.actorName}</span> <span className="text-fog/65">{describeAudit(a)}</span>
                      </p>
                      <p className="mt-0.5 text-[11.5px] text-fog/35">{timeAgo(a.createdAt)}</p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        )}
      </main>

      <UserSheet
        target={sheet}
        sessions={data?.sessions ?? []}
        isSelf={(id) => id === user?.id}
        onClose={() => setSheet(null)}
        onSaved={(payload, message) => {
          setData(payload);
          showToast(message);
        }}
      />

      {toast && (
        <div
          role="status"
          className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 z-[70] flex -translate-x-1/2 animate-toast-in items-center gap-2.5 whitespace-nowrap rounded-full bg-night-700/95 py-2.5 pl-2.5 pr-4 text-[13.5px] font-medium shadow-[0_20px_50px_-10px_rgb(var(--shade)/var(--shade-a))] ring-1 ring-line/10 backdrop-blur-xl"
        >
          <span className="grid h-6 w-6 place-items-center rounded-full bg-brand text-brand-fg">
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
          {toast}
        </div>
      )}
    </div>
  );
}
