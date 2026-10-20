import { createClient } from '@supabase/supabase-js';
import {
  UserControlError,
  createUser,
  deleteUser,
  loadUserControl,
  recordSession,
  requireOwner,
  revealPassword,
  revokeAllSessions,
  revokeSession,
  saveSettings,
  updateUser,
  userFromBearer,
} from '../server/userControl.js';

function normalizeEnv(value?: string) {
  if (!value) return '';
  return value.trim().replace(/^['"]|['"]$/g, '');
}

type Req = { method?: string; body?: unknown; headers?: Record<string, string | string[] | undefined> };
type Res = { status: (code: number) => Res; json: (body: unknown) => Res };
type Body = Record<string, unknown>;

function header(req: Req, name: string): string | undefined {
  const value = req.headers?.[name];
  return Array.isArray(value) ? value[0] : value;
}

function readBody(req: Req): Body {
  const raw = req.body;
  if (raw && typeof raw === 'object' && !Buffer.isBuffer(raw)) return raw as Body;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * User control API. Every action except `recordSession` is owner-only.
 * Mutations return the refreshed payload so the screen re-renders in one trip.
 */
export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = normalizeEnv(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
  const serviceRoleKey = normalizeEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Supabase environment variables are not configured.' });
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const body = readBody(req);
  try {
    const authUser = await userFromBearer(admin, header(req, 'authorization'));

    if (body.action === 'recordSession') {
      await recordSession(admin, authUser, body.event, header(req, 'user-agent'));
      return res.status(200).json({ ok: true });
    }

    const actor = await requireOwner(admin, authUser);
    switch (body.action) {
      case 'load':
        break;
      case 'createUser':
        await createUser(admin, actor, body as Parameters<typeof createUser>[2]);
        break;
      case 'updateUser':
        await updateUser(admin, actor, body as Parameters<typeof updateUser>[2]);
        break;
      case 'deleteUser':
        await deleteUser(admin, actor, body.id as string | undefined);
        break;
      case 'revealPassword':
        return res.status(200).json({ password: await revealPassword(admin, actor, body.id as string | undefined) });
      case 'revokeSession':
        await revokeSession(admin, actor, body.sessionId as string | undefined, body.userName as string | undefined);
        break;
      case 'revokeAllSessions':
        await revokeAllSessions(admin, actor, body.id as string | undefined);
        break;
      case 'saveSettings':
        await saveSettings(admin, actor, body.settings);
        break;
      default:
        return res.status(400).json({ error: 'Unknown action.' });
    }
    return res.status(200).json(await loadUserControl(admin));
  } catch (err) {
    const status = err instanceof UserControlError ? err.status : 500;
    if (status >= 500) console.error('user-control failed:', err);
    return res.status(status).json({ error: err instanceof Error ? err.message : 'Something went wrong.' });
  }
}
