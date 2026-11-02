import { and, eq, inArray, lt } from 'drizzle-orm';
import { db, schema as t } from '@/db';
import { uid } from './util';

const APP_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';
type NotifySettings = { inapp?: boolean; email?: boolean; teams?: boolean };

/** In-app notification plus queued email (Microsoft 365) and Teams messages, per Admin › Notifications. */
export async function notify(userIds: string | string[], text: string, link?: string) {
  const ids = [...new Set(Array.isArray(userIds) ? userIds : [userIds])].filter(Boolean);
  if (!ids.length) return;
  const cfg = ((await db.select().from(t.settings).where(eq(t.settings.key, 'notify')))[0]?.value || {}) as NotifySettings;
  const users = await db.select().from(t.users).where(inArray(t.users.id, ids));
  if (cfg.inapp !== false) await db.insert(t.notifications).values(users.map((u) => ({ id: uid('n'), userId: u.id, text, link: link || null })));
  const url = link ? APP_URL + link : APP_URL;
  const rows: (typeof t.outbox.$inferInsert)[] = [];
  for (const u of users) {
    if (cfg.email !== false && u.email) rows.push({ id: uid('ob'), channel: 'email', to: u.email, subject: 'QA Studio: ' + text.slice(0, 90), body: `${text}\n\nOpen: ${url}` });
    if (cfg.teams !== false && u.email && process.env.TEAMS_WEBHOOK_URL) rows.push({ id: uid('ob'), channel: 'teams', to: u.email, subject: text.slice(0, 90), body: `${u.name}: ${text} (${url})` });
  }
  if (rows.length) await db.insert(t.outbox).values(rows);
}

async function graphToken() {
  const tenant = process.env.AZURE_AD_TENANT_ID, id = process.env.GRAPH_CLIENT_ID || process.env.AZURE_AD_CLIENT_ID, secret = process.env.GRAPH_CLIENT_SECRET || process.env.AZURE_AD_CLIENT_SECRET;
  if (!tenant || !id || !secret) throw new Error('Graph credentials are not configured');
  const r = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: id, client_secret: secret, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' }) });
  if (!r.ok) throw new Error('Token request failed: ' + r.status);
  return (await r.json()).access_token as string;
}

/** Sends queued messages. Called by /api/cron/outbox (Vercel Cron, every 5 minutes). */
export async function flushOutbox(limit = 50) {
  const q = await db.select().from(t.outbox).where(and(eq(t.outbox.status, 'Queued'), lt(t.outbox.attempts, 5))).limit(limit);
  if (!q.length) return { sent: 0, failed: 0 };
  let token: string | null = null, sent = 0, failed = 0;
  const sender = process.env.GRAPH_SENDER;
  for (const m of q) {
    try {
      if (m.channel === 'email') {
        if (!sender) throw new Error('GRAPH_SENDER is not set');
        token = token || (await graphToken());
        const r = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: { subject: m.subject, body: { contentType: 'Text', content: m.body }, toRecipients: [{ emailAddress: { address: m.to } }] }, saveToSentItems: false }) });
        if (!r.ok) throw new Error('sendMail ' + r.status + ' ' + (await r.text()).slice(0, 200));
      } else {
        const hook = process.env.TEAMS_WEBHOOK_URL; if (!hook) throw new Error('TEAMS_WEBHOOK_URL is not set');
        const r = await fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: m.body }) });
        if (!r.ok) throw new Error('Teams webhook ' + r.status);
      }
      await db.update(t.outbox).set({ status: 'Sent', sentAt: new Date(), attempts: m.attempts + 1 }).where(eq(t.outbox.id, m.id)); sent++;
    } catch (e) {
      const attempts = m.attempts + 1;
      await db.update(t.outbox).set({ attempts, lastError: String((e as Error).message).slice(0, 500), status: attempts >= 5 ? 'Failed' : 'Queued' }).where(eq(t.outbox.id, m.id)); failed++;
    }
  }
  return { sent, failed };
}

export async function logAct(userId: string | null, text: string) { await db.insert(t.activityLog).values({ id: uid('lg'), userId, text }); }
