// Every push notification's wording lives here.
//
// Format: the TITLE says what happened to whom (it's what shows on a locked
// phone); the BODY says who did it, what changed, and where things stand now,
// as short " · "-separated parts.
//
// Used by the browser (src/lib/pushNotify.ts) and by the Vercel functions
// (api/*.ts, server/*.ts) — keep this file free of imports so it runs in both.

export type EntryKind = 'rental' | 'jcb';

export interface NotificationMessage {
  title: string;
  body: string;
  /** app_notifications.kind — decides which per-user switch applies (see userAccess.ts). */
  kind: string;
}

/** What a template needs to know about one rental / JCB entry. */
export interface EntrySnapshot {
  entity: EntryKind;
  name: string;
  total: number;
  received: number;
  /** Still owed, never negative. */
  pending: number;
  /** One per job, e.g. { equipment: 'Rotavator', detail: '4.5 acres × 1' }. */
  jobs: { equipment: string; detail: string }[];
  /** Equipment names only, e.g. "Rotavator, Cage Wheel". */
  equipment: string;
  oldBalance: { amount: number; status: 'paid' | 'pending' } | null;
}

const ICON: Record<EntryKind, string> = { rental: '🚜', jcb: '🏗️' };

// ── Formatting ──────────────────────────────────────────────────────────────

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export function money(amount: number): string {
  return inr.format(Math.round(amount || 0));
}

/** ₹48,200 · ₹2.1L · ₹1.4Cr — keeps big totals short on a lock screen. */
export function moneyCompact(amount: number): string {
  const abs = Math.abs(amount || 0);
  const sign = amount < 0 ? '−' : '';
  const trim = (n: number) => n.toFixed(n >= 100 ? 0 : 1).replace(/\.0$/, '');
  if (abs >= 1e7) return `${sign}₹${trim(abs / 1e7)}Cr`;
  if (abs >= 1e5) return `${sign}₹${trim(abs / 1e5)}L`;
  return `${sign}${money(abs)}`;
}

/** "7:42 PM" in India time, whatever the server's timezone. */
export function timeIST(date: Date = new Date()): string {
  return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }).toUpperCase();
}

function parts(...items: (string | null | undefined | false)[]): string {
  return items.filter(Boolean).join(' · ');
}

function by(actor: string | null | undefined): string | null {
  return actor ? `By ${actor}` : null;
}

function nowLine(s: EntrySnapshot): string {
  return s.pending > 0 ? `Now ${money(s.pending)} pending` : 'Now fully paid';
}

function paidPercent(s: EntrySnapshot): number {
  return s.total > 0 ? Math.min(100, Math.round((s.received / s.total) * 100)) : 100;
}

function subject(s: EntrySnapshot): string {
  return s.entity === 'jcb' ? `JCB · ${s.name}` : s.name;
}

// ── Entry events ────────────────────────────────────────────────────────────

export function entryCreated(s: EntrySnapshot, actor?: string | null): NotificationMessage {
  return {
    title: `${ICON[s.entity]} New ${s.entity === 'jcb' ? 'JCB ' : ''}entry · ${s.name}`,
    body: parts(
      by(actor),
      s.equipment || (s.oldBalance ? 'Old balance' : null),
      money(s.total),
      s.pending > 0 ? `${money(s.pending)} pending` : 'Fully paid',
    ),
    kind: `${s.entity}_created`,
  };
}

export function paymentCollected(after: EntrySnapshot, amount: number, actor?: string | null): NotificationMessage {
  if (after.pending <= 0) {
    return {
      title: `✅ ${subject(after)} fully paid`,
      body: parts(by(actor), `Final ${money(amount)} collected`, `${money(after.total)} settled`),
      kind: `${after.entity}_collected`,
    };
  }
  return {
    title: `💰 ${money(amount)} from ${subject(after)}`,
    body: parts(by(actor), `${money(after.pending)} still pending (${paidPercent(after)}% paid)`),
    kind: `${after.entity}_collected`,
  };
}

export function entryDeleted(s: EntrySnapshot, actor?: string | null): NotificationMessage {
  return {
    title: `🗑️ ${subject(s)} entry deleted`,
    body: parts(
      by(actor),
      `${money(s.total)} entry`,
      s.pending > 0 ? `${money(s.pending)} was still pending` : 'was fully paid',
    ),
    kind: `${s.entity}_deleted`,
  };
}

/** Human list of what changed between two versions of an entry. */
export function describeChanges(before: EntrySnapshot, after: EntrySnapshot): string[] {
  const changes: string[] = [];
  if (before.name !== after.name) changes.push(`Name ${before.name} → ${after.name}`);

  const jobKey = (j: { equipment: string; detail: string }) => `${j.equipment} ${j.detail}`;
  if (before.jobs.map(jobKey).join('|') !== after.jobs.map(jobKey).join('|')) {
    if (before.jobs.length === after.jobs.length) {
      before.jobs.forEach((job, i) => {
        const next = after.jobs[i];
        if (jobKey(job) === jobKey(next)) return;
        // Same machine: only the numbers moved, so don't repeat its name.
        changes.push(
          job.equipment === next.equipment
            ? `${job.equipment} ${job.detail} → ${next.detail}`
            : `${jobKey(job)} → ${jobKey(next)}`,
        );
      });
    } else {
      changes.push(`Jobs ${before.jobs.length} → ${after.jobs.length}`);
    }
  }

  if (before.total !== after.total) changes.push(`Total ${money(before.total)} → ${money(after.total)}`);
  if (before.received !== after.received) changes.push(`Received ${money(before.received)} → ${money(after.received)}`);

  const ob = before.oldBalance;
  const oa = after.oldBalance;
  if (!ob && oa) changes.push(`Old balance ${money(oa.amount)} added`);
  else if (ob && !oa) changes.push('Old balance removed');
  else if (ob && oa) {
    if (ob.amount !== oa.amount) changes.push(`Old balance ${money(ob.amount)} → ${money(oa.amount)}`);
    if (ob.status !== oa.status) changes.push(`Old balance marked ${oa.status}`);
  }
  return changes;
}

const MAX_CHANGES = 3;

/**
 * An edit. Returns null when nothing meaningful changed (no point pinging
 * everyone about a save with no differences). A lowered received amount is
 * its own warning — money going backwards should never look like a routine edit.
 */
export function entryEdited(before: EntrySnapshot, after: EntrySnapshot, actor?: string | null): NotificationMessage | null {
  if (after.received < before.received) return paymentReduced(before, after, actor);

  const changes = describeChanges(before, after);
  if (!changes.length) return null;
  const shown = changes.slice(0, MAX_CHANGES);
  if (changes.length > MAX_CHANGES) shown.push(`+${changes.length - MAX_CHANGES} more`);
  return {
    title: `✏️ ${subject(after)} edited`,
    body: parts(by(actor), ...shown, nowLine(after)),
    kind: `${after.entity}_updated`,
  };
}

export function paymentReduced(before: EntrySnapshot, after: EntrySnapshot, actor?: string | null): NotificationMessage {
  const drop = before.received - after.received;
  const others = describeChanges(before, after).filter((c) => !c.startsWith('Received '));
  return {
    title: `⚠️ Payment reduced · ${subject(after)}`,
    body: parts(
      by(actor),
      `Received ${money(before.received)} → ${money(after.received)} (−${money(drop)})`,
      others.length ? `also ${others.slice(0, 2).join(', ')}` : null,
      nowLine(after),
    ),
    kind: `${after.entity}_payment_reduced`,
  };
}

// ── Scheduled digests ───────────────────────────────────────────────────────

export interface PendingDigestItem {
  entity: EntryKind;
  name: string;
  amount: number;
  daysOld: number;
}

/** Daily nudge for entries pending 10+ days. `items` sorted oldest first. */
export function pendingDigest(items: PendingDigestItem[], totalPending: number, listLimit = 4): NotificationMessage {
  const shown = items.slice(0, listLimit).map((o) => `${o.entity === 'jcb' ? 'JCB ' : ''}${o.name} ${money(o.amount)} (${o.daysOld}d)`);
  const more = items.length - shown.length;
  if (more > 0) shown.push(`+${more} more`);
  return {
    title: `⏰ ${moneyCompact(totalPending)} pending 10+ days · ${items.length} ${items.length === 1 ? 'person' : 'people'}`,
    body: shown.join(' · '),
    kind: 'pending_digest',
  };
}

export interface DailySummaryData {
  /** Net money received today: collections minus any received amounts taken back. */
  netCollected: number;
  newEntries: number;
  newEntriesTotal: number;
  pendingOverall: number;
}

/**
 * 9:30 PM IST wrap-up of the day — only what matters at a glance: money that
 * actually came in, new work added, and what's still owed. Same-day
 * corrections cancel out (collected then reversed = nothing), so there's no
 * "collected ₹X … reduced ₹X" pair to puzzle over. A net negative day (more
 * taken back than received, e.g. undoing an earlier payment) is flagged.
 */
export function dailySummary(d: DailySummaryData): NotificationMessage {
  const title =
    d.netCollected > 0
      ? `💰 Today · ${money(d.netCollected)} collected`
      : d.netCollected < 0
        ? `💰 Today · ⚠️ ${money(-d.netCollected)} reversed`
        : '💰 Today · No collections';
  return {
    title,
    body: parts(
      d.newEntries > 0
        ? `${d.newEntries} new ${d.newEntries === 1 ? 'entry' : 'entries'} (${moneyCompact(d.newEntriesTotal)})`
        : 'No new entries',
      `${moneyCompact(d.pendingOverall)} pending`,
    ),
    kind: 'daily_summary',
  };
}

// ── Sign-in / sign-out ──────────────────────────────────────────────────────

export function sessionEvent(name: string, event: 'login' | 'logout', device: string, at: Date = new Date()): NotificationMessage {
  return {
    title: `🔐 ${name} ${event === 'login' ? 'signed in' : 'signed out'}`,
    body: parts(device, timeIST(at)),
    kind: `session_${event}`,
  };
}
