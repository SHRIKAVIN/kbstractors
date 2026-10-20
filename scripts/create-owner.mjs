#!/usr/bin/env node
// One-time setup: create (or reset) the owner login "shrikavin" — the only
// account that can open User control. Run after applying the user-control
// migration:
//
//   vercel env pull .env.local        # or export the two vars below yourself
//   npm run setup:owner
//
// Needs SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.
// The password is typed here and goes straight to Supabase Auth.

import { createClient } from '@supabase/supabase-js';
import { createInterface } from 'node:readline';

const OWNER_EMAIL = 'shrikavinkbs@gmail.com';
const OWNER_USERNAME = 'shrikavin';
const OWNER_NAME = 'Shrikavin';

for (const file of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(file);
  } catch {
    /* file not present */
  }
}

const clean = (v) => (v ?? '').trim().replace(/^['"]|['"]$/g, '');
const url = clean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
const serviceKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (set them or run `vercel env pull .env.local`).');
  process.exit(1);
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => {
      if (s.includes(question)) rl.output.write(s);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

const password = await askHidden(`Password for "${OWNER_USERNAME}": `);
if (password.length < 6) {
  console.error('Password must be at least 6 characters.');
  process.exit(1);
}
const confirm = await askHidden('Repeat password: ');
if (confirm !== password) {
  console.error('Passwords do not match.');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

let userId;
for (let page = 1; page < 20 && !userId; page += 1) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
  if (error) throw error;
  userId = data.users.find((u) => u.email?.toLowerCase() === OWNER_EMAIL)?.id;
  if (data.users.length < 200) break;
}

if (userId) {
  const { error } = await admin.auth.admin.updateUserById(userId, { password, ban_duration: 'none' });
  if (error) throw error;
} else {
  const { data, error } = await admin.auth.admin.createUser({ email: OWNER_EMAIL, password, email_confirm: true });
  if (error) throw error;
  userId = data.user.id;
}

const { error: rowErr } = await admin.from('app_users').upsert({
  id: userId,
  username: OWNER_USERNAME,
  name: OWNER_NAME,
  is_owner: true,
  login_enabled: true,
  access: {
    tractor: ['read', 'create', 'update', 'delete', 'collect'],
    jcb: ['read', 'create', 'update', 'delete'],
  },
  notifications: ['tractor', 'collection', 'jcb', 'reminders', 'summary', 'session'],
});
if (rowErr) {
  console.error('Could not save the owner row — did you apply the user-control migration?', rowErr.message);
  process.exit(1);
}

console.log(`Done. Sign in as "${OWNER_USERNAME}" — User control is in the ••• menu.`);
