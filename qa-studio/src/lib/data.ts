import { and, asc, eq, gte, inArray, lte, desc } from 'drizzle-orm';
import { db, schema as t } from '@/db';
import { addDays, today, weekEnding } from './dates';
import type { SessionUser } from './rbac';
import { scopeOf } from './scope';

export type UserRow = typeof t.users.$inferSelect;
export type ParamRow = typeof t.params.$inferSelect;
export type FormFull = typeof t.forms.$inferSelect & { sections: (typeof t.sections.$inferSelect & { params: ParamRow[] })[] };

export async function getUsers() { return db.select().from(t.users).orderBy(asc(t.users.name)); }
export function nameOf(users: UserRow[], id?: string | null) { return (id && users.find((u) => u.id === id)?.name) || '—'; }

export async function getForms(ids?: string[]): Promise<FormFull[]> {
  const fs = ids ? await db.select().from(t.forms).where(inArray(t.forms.id, ids)) : await db.select().from(t.forms).orderBy(asc(t.forms.channel), desc(t.forms.version));
  if (!fs.length) return [];
  const fids = fs.map((f) => f.id);
  const ss = await db.select().from(t.sections).where(inArray(t.sections.formId, fids)).orderBy(asc(t.sections.ord));
  const ps = await db.select().from(t.params).where(inArray(t.params.formId, fids)).orderBy(asc(t.params.ord));
  return fs.map((f) => ({ ...f, sections: ss.filter((s) => s.formId === f.id).map((s) => ({ ...s, params: ps.filter((p) => p.sectionId === s.id) })) }));
}
export async function getForm(id: string) { return (await getForms([id]))[0] || null; }
export async function activeForms() { return (await getForms()).filter((f) => f.status === 'Active'); }

export type Filters = { from: string; to: string; by: 'audit' | 'call'; cl: string; customer: string; lob: string; channel: string; agent: string; auditor: string; we: string };
export function parseFilters(sp: Record<string, string | string[] | undefined>): Filters {
  const g = (k: string) => (Array.isArray(sp[k]) ? (sp[k] as string[])[0] : (sp[k] as string)) || '';
  const t0 = today(); const ok = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  const f: Filters = { from: ok(g('from')) ? g('from') : addDays(t0, -89), to: ok(g('to')) ? g('to') : t0, by: g('by') === 'call' ? 'call' : 'audit', cl: g('cl'), customer: g('customer'), lob: g('lob'), channel: g('channel'), agent: g('agent'), auditor: g('auditor'), we: ok(g('we')) ? g('we') : '' };
  if (f.we) { f.from = addDays(f.we, -6); f.to = f.we; }
  return f;
}

export type AuditX = typeof t.audits.$inferSelect & {
  answers: Record<string, string>; aois: (typeof t.aois.$inferSelect)[];
  ack: typeof t.acknowledgements.$inferSelect | null; dispute: typeof t.disputes.$inferSelect | null; deliveredAt: Date | null;
};

/** Audits the user may see between two dates, with answers, AOIs, acknowledgement, dispute and delivery attached. */
export async function loadAudits(u: SessionUser, from: string, to: string, opts: { by?: 'audit' | 'call'; ids?: string[] } = {}): Promise<AuditX[]> {
  const col = opts.by === 'call' ? t.audits.interactionDate : t.audits.auditDate;
  const conds = [gte(col, from), lte(col, to)];
  if (u.role === 'agent') conds.push(eq(t.audits.agentId, u.id));
  // client stakeholders and company staff only ever get audits of the clients in their scope
  const scope = await scopeOf(u);
  if (scope !== null) { if (!scope.length) return []; conds.push(inArray(t.audits.clientId, scope)); }
  const rows0 = opts.ids ? await db.select().from(t.audits).where(and(inArray(t.audits.id, opts.ids), ...(scope ? [inArray(t.audits.clientId, scope)] : []), ...(u.role === 'agent' ? [eq(t.audits.agentId, u.id)] : []))) : await db.select().from(t.audits).where(and(...conds)).orderBy(desc(t.audits.auditDate));
  const rows = u.role === 'tl' ? rows0.filter((a) => a.tlId === u.id || a.auditorId === u.id) : rows0;
  if (!rows.length) return [];
  const ids = rows.map((a) => a.id);
  const chunks = <T,>(f: (part: string[]) => Promise<T[]>) => Promise.all(Array.from({ length: Math.ceil(ids.length / 1000) }, (_, i) => f(ids.slice(i * 1000, i * 1000 + 1000)))).then((r) => r.flat());
  const [ans, ao, ak, dp, fb] = await Promise.all([
    chunks((p) => db.select().from(t.answers).where(inArray(t.answers.auditId, p))),
    chunks((p) => db.select().from(t.aois).where(inArray(t.aois.auditId, p))),
    chunks((p) => db.select().from(t.acknowledgements).where(inArray(t.acknowledgements.auditId, p))),
    chunks((p) => db.select().from(t.disputes).where(inArray(t.disputes.auditId, p))),
    chunks((p) => db.select().from(t.feedbackSessions).where(inArray(t.feedbackSessions.auditId, p))),
  ]);
  const m = new Map(rows.map((a) => [a.id, { ...a, answers: {} as Record<string, string>, aois: [] as AuditX['aois'], ack: null as AuditX['ack'], dispute: null as AuditX['dispute'], deliveredAt: null as Date | null }]));
  ans.forEach((x) => { const a = m.get(x.auditId); if (a) a.answers[x.paramId] = x.value; });
  ao.forEach((x) => m.get(x.auditId)?.aois.push(x));
  ak.forEach((x) => { const a = m.get(x.auditId); if (a) a.ack = x; });
  dp.sort((x, y) => +x.raisedAt - +y.raisedAt).forEach((x) => { const a = m.get(x.auditId); if (a) a.dispute = x; });
  fb.forEach((x) => { const a = m.get(x.auditId); if (a && (!a.deliveredAt || x.at < a.deliveredAt)) a.deliveredAt = x.at; });
  return [...m.values()];
}

export function applyFilters(A: AuditX[], f: Filters) {
  const d = (a: AuditX) => (f.by === 'call' ? a.interactionDate : a.auditDate);
  return A.filter((a) => d(a) >= f.from && d(a) <= f.to && (!f.cl || a.clientId === f.cl) && (!f.customer || a.customer === f.customer) && (!f.lob || a.lob === f.lob) && (!f.channel || a.channel === f.channel) && (!f.agent || a.agentId === f.agent) && (!f.auditor || a.auditorId === f.auditor));
}
export function weekOptions(n = 16) { const we = weekEnding(today()); return Array.from({ length: n }, (_, i) => addDays(we, -7 * i)); }

export async function paramIndex() {
  const [ps, ss, fs] = await Promise.all([db.select().from(t.params), db.select().from(t.sections), db.select().from(t.forms)]);
  const idx: Record<string, ParamRow & { section: string; channel: string }> = {};
  ps.forEach((p) => (idx[p.id] = { ...p, section: ss.find((s) => s.id === p.sectionId)?.name || '', channel: fs.find((f) => f.id === p.formId)?.channel || '' }));
  return idx;
}
export async function getSetting<T>(key: string, def: T): Promise<T> {
  const r = await db.select().from(t.settings).where(eq(t.settings.key, key));
  return (r[0]?.value as T) ?? def;
}
export async function setSetting(key: string, value: unknown) {
  await db.insert(t.settings).values({ key, value }).onConflictDoUpdate({ target: t.settings.key, set: { value } });
}
