import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import { recordSessionEvent } from '../lib/userControlApi';
import {
  FULL_ACCESS,
  isValidUsername,
  normalizeUsername,
  sanitizeAccess,
  type AccessAction,
  type AccessSection,
  type UserAccess,
} from '../lib/userAccess';

export interface AppProfile {
  id: string;
  username: string;
  name: string;
  isOwner: boolean;
  loginEnabled: boolean;
  access: UserAccess;
}

interface AuthContextType {
  user: User | null;
  /** This login's app_users row; null while loading or when it has none. */
  profile: AppProfile | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  can: (section: AccessSection, action: AccessAction) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const BAD_LOGIN = 'தவறான பயனர் பெயர் அல்லது கடவுச்சொல்';
const DISABLED_LOGIN = 'இந்த உள்நுழைவு முடக்கப்பட்டுள்ளது';

const LOGIN_MESSAGE_KEY = 'kbs.login.message';

/** One-shot message for the login screen (e.g. "this login was disabled"). */
function flashLoginMessage(message: string) {
  try {
    sessionStorage.setItem(LOGIN_MESSAGE_KEY, message);
  } catch {
    /* storage unavailable */
  }
}

export function takeLoginMessage(): string {
  try {
    const message = sessionStorage.getItem(LOGIN_MESSAGE_KEY) ?? '';
    sessionStorage.removeItem(LOGIN_MESSAGE_KEY);
    return message;
  } catch {
    return '';
  }
}

type ProfileRow = { id: string; username: string; name: string; is_owner: boolean; login_enabled: boolean; access: unknown };

function toProfile(row: ProfileRow): AppProfile {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    isOwner: Boolean(row.is_owner),
    loginEnabled: row.login_enabled !== false,
    access: row.is_owner ? FULL_ACCESS : sanitizeAccess(row.access),
  };
}

/**
 * Loads the signed-in user's profile. If app_users can't be read at all the
 * user-control migration hasn't run yet — fall back to full access so the
 * app keeps working exactly as before until it does.
 */
async function fetchProfile(user: User): Promise<AppProfile | null> {
  const { data, error } = await supabase.from('app_users').select('*').eq('id', user.id).maybeSingle();
  if (error) {
    console.warn('Could not load app_users — assuming full access until the migration is applied:', error.message);
    return { id: user.id, username: user.email ?? '', name: user.email ?? '', isOwner: false, loginEnabled: true, access: FULL_ACCESS };
  }
  return data ? toProfile(data as ProfileRow) : null;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const signIn = async (username: string, password: string) => {
    const login = normalizeUsername(username);
    if (!isValidUsername(login) || !password) throw new Error(BAD_LOGIN);

    const { data: email, error: lookupError } = await supabase.rpc('resolve_login_email', { p_username: login });
    if (lookupError || !email) throw new Error(BAD_LOGIN);

    const { data, error } = await supabase.auth.signInWithPassword({ email: email as string, password });
    if (error) {
      throw new Error(/banned/i.test(error.message) ? DISABLED_LOGIN : BAD_LOGIN);
    }
    setUser(data.user);
    void recordSessionEvent('login');
  };

  const signOut = useCallback(async () => {
    await recordSessionEvent('logout');
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) void supabase.realtime.setAuth(session.access_token);
      setUser(session?.user ?? null);
      if (!session) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.access_token) void supabase.realtime.setAuth(session.access_token);
      setUser(session?.user ?? null);
      if (!session) {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Profile follows the user, and updates live when the owner changes this
  // login's access on User control (or disables it).
  useEffect(() => {
    if (!user) return;
    let disposed = false;
    setLoading(true);

    const apply = (next: AppProfile | null) => {
      if (disposed) return;
      if (next && !next.loginEnabled) {
        flashLoginMessage(DISABLED_LOGIN);
        void supabase.auth.signOut();
        return;
      }
      setProfile(next);
      setLoading(false);
    };

    void fetchProfile(user).then(apply);

    const channel = supabase
      .channel(`app-user-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_users', filter: `id=eq.${user.id}` }, (payload) => {
        if (payload.eventType === 'DELETE') {
          flashLoginMessage(DISABLED_LOGIN);
          void supabase.auth.signOut();
          return;
        }
        apply(toProfile(payload.new as ProfileRow));
      })
      .subscribe();

    const refetch = () => {
      if (document.visibilityState === 'visible') void fetchProfile(user).then(apply);
    };
    document.addEventListener('visibilitychange', refetch);

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', refetch);
      void supabase.removeChannel(channel);
    };
  }, [user]);

  const can = useCallback(
    (section: AccessSection, action: AccessAction) =>
      Boolean(profile && profile.loginEnabled && (profile.isOwner || profile.access[section]?.includes(action))),
    [profile],
  );

  return (
    <AuthContext.Provider value={{ user, profile, signIn, signOut, loading, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
