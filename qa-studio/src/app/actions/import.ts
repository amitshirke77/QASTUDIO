'use server';
import * as XLSX from 'xlsx';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db, schema as t } from '@/db';
import { requireUser } from '@/lib/auth';
import { getForm, getUsers } from '@/lib/data';
import { scoreOf } from '@/lib/scoring';
import { weekEnding, monthLabel } from '@/lib/dates';
import { logAct } from '@/lib/notify';
import { uid } from '@/lib/util';
import { done, fail, type Result } from './_util';

import { norm, FIELDS } from '@/lib/importCols';
import { scopeOf, inScope } from '@/lib/scope';
function toDate(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') { const d = XLSX.SSF.parse_date_code(v); return d ? `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}` : null; }
  const s = String(v).trim(); let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/))) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  const d = new Date(s); return isNaN(+d) ? null : d.toISOString().slice(0, 10);
}
const rating = (v: unknown) => { const s = norm(v); return s === 'y' || s === 'yes' ? 'Y' : s === 'n' || s === 'no' ? 'N' : s === 'na' || s === 'n a' ? 'NA' : null; };

/** Import past audits from the Quality Sheet (xlsx/csv). dryRun=true returns a preview without saving. */
export async function importAudits(fd: FormData): Promise<Result<{ rows: number; ok: number; skipped: { row: number; why: string }[]; mapped: string[]; unmappedParams: string[]; newAgents: string[] }>> {
  const u = await requireUser('import');
  const file = fd.get('file') as File | null; const formId = String(fd.get('formId') || ''); const dry = fd.get('dryRun') === 'true';
  const defLob = String(fd.get('lob') || 'Tripstacc'), defTl = String(fd.get('tlId') || ''), missingNA = fd.get('missingNA') === 'true', addAgents = fd.get('addAgents') === 'true';
  if (!file || !file.size) return fail('Choose a file.'); if (file.size > 15e6) return fail('The file is larger than 15 MB.');
  const form = await getForm(formId); if (!form) return fail('Pick the form these audits used.');
  const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer', cellDates: false });
  const ws = wb.Sheets[String(fd.get('sheet') || '') || wb.SheetNames[0]]; if (!ws) return fail('Sheet not found.');
  const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: '' });
  const hi = grid.findIndex((r) => r.some((c) => FIELDS.caseId.includes(norm(c)))); if (hi < 0) return fail('No header row with a "Case ID" column was found.');
  const head = grid[hi].map(norm);
  const col: Record<string, number> = {}; Object.entries(FIELDS).forEach(([k, names]) => { const i = head.findIndex((h) => names.includes(h)); if (i >= 0) col[k] = i; });
  const params = form.sections.flatMap((s) => s.params);
  const pcol: Record<string, number> = {}; params.forEach((p) => { const i = head.findIndex((h) => h === norm(p.name) || h === norm(p.code) || (h.length > 8 && norm(p.name).startsWith(h))); if (i >= 0) pcol[p.id] = i; });
  const users = await getUsers(); const byName = (n: string, roles: string[]) => users.find((x) => roles.includes(x.role) && norm(x.name) === norm(n));
  const skipped: { row: number; why: string }[] = []; const newAgents = new Map<string, string>(); const rows: { a: typeof t.audits.$inferInsert; ans: Record<string, string>; obs: string }[] = [];
  const existing = new Set((await db.select({ c: t.audits.caseId }).from(t.audits)).map((x) => x.c));
  const scope = await scopeOf(u); const custRows = await db.select().from(t.customers); const defClient = String(fd.get('clientId') || '');
  if (!defClient || !inScope(scope, defClient)) return fail('Pick the client these audits belong to.');
  const clientLobs = (await db.select().from(t.lobs).where(eq(t.lobs.clientId, defClient))).map((l) => l.name);
  if (!clientLobs.includes(defLob)) return fail('Pick a default LOB of this client.');
  const defCompany = (await db.select().from(t.clients).where(eq(t.clients.id, defClient)))[0]?.companyId || null;
  for (let r = hi + 1; r < grid.length; r++) {
    const g = grid[r]; const v = (k: string) => (col[k] != null ? g[col[k]] : '');
    const caseId = String(v('caseId')).trim(); if (!caseId) continue;
    if (existing.has(caseId)) { skipped.push({ row: r + 1, why: `${caseId} already exists` }); continue; }
    const auditDate = toDate(v('auditDate')); const callDate = toDate(v('callDate')) || auditDate;
    if (!auditDate) { skipped.push({ row: r + 1, why: 'no valid audit date' }); continue; }
    const agName = String(v('agent')).trim(); let agent = byName(agName, ['agent']);
    if (agent && agent.clientId !== defClient) { skipped.push({ row: r + 1, why: `${agName} works on another client` }); continue; }
    const custName = String(v('customer')).trim().toUpperCase();
    if (custName && !custRows.some((c) => c.clientId === defClient && c.name === custName)) { skipped.push({ row: r + 1, why: `customer "${custName}" is not set up under this client (Master data)` }); continue; }
    let agentId = agent?.id;
    if (!agentId) { if (!agName || !addAgents || !defTl) { skipped.push({ row: r + 1, why: `unknown agent "${agName}"` }); continue; } agentId = newAgents.get(norm(agName)) || uid('a'); newAgents.set(norm(agName), agentId); }
    const auditor = byName(String(v('auditor')), ['auditor', 'qalead', 'admin', 'tl']);
    const ans: Record<string, string> = {}; let bad = '';
    for (const p of params) { const x = pcol[p.id] != null ? rating(g[pcol[p.id]]) : null; if (x && p.options.includes(x)) ans[p.id] = x; else if (missingNA && p.options.includes('NA')) ans[p.id] = 'NA'; else { bad = p.name; break; } }
    if (bad) { skipped.push({ row: r + 1, why: `no valid rating for "${bad}"` }); continue; }
    const sc = scoreOf(form, ans); const fl = norm(v('lob')); const lob = clientLobs.find((l) => fl && (norm(l) === fl || norm(l).includes(fl) || fl.includes(norm(l)))) || agent?.lob || defLob;
    rows.push({ a: { id: uid('AU'), caseId, agentId, auditorId: auditor?.id || u.id, tlId: agent?.tlId || defTl || u.id, formId, channel: form.channel, lob, product: String(v('product')).trim() || '—', customer: String(v('customer')).trim().toUpperCase() || '—', clientId: defClient, auditDate, weekEnding: weekEnding(auditDate), month: monthLabel(auditDate), interactionDate: callDate!, phone: String(v('phone')).slice(0, 20) || null, link: String(v('link')).slice(0, 1000) || null, observations: String(v('obs')).slice(0, 5000), overall: sc.overall, actual: sc.actual, fatal: sc.fatal, status: 'Acknowledged' }, ans, obs: '' });
    existing.add(caseId);
  }
  const summary = { rows: grid.length - hi - 1, ok: rows.length, skipped: skipped.slice(0, 200), mapped: Object.keys(col), unmappedParams: params.filter((p) => pcol[p.id] == null).map((p) => p.name), newAgents: [...newAgents.keys()] };
  if (dry || !rows.length) return done(summary);
  const batch = uid('ib');
  await db.transaction(async (tx) => {
    await tx.insert(t.importBatches).values({ id: batch, file: file.name.slice(0, 200), formId, importedBy: u.id, at: new Date(), count: rows.length, skipped: skipped.length });
    for (const [n, id] of newAgents) await tx.insert(t.users).values({ id, name: n.replace(/\b\w/g, (c) => c.toUpperCase()), role: 'agent', username: n.replace(/\s+/g, '.') + '.' + id.slice(-4), authSso: true, authPassword: false, lob: defLob, tlId: defTl, clientId: defClient, companyId: defCompany, importBatchId: batch });
    for (let i = 0; i < rows.length; i += 200) {
      const part = rows.slice(i, i + 200);
      await tx.insert(t.audits).values(part.map((x) => ({ ...x.a, importBatchId: batch })));
      await tx.insert(t.answers).values(part.flatMap((x) => Object.entries(x.ans).map(([paramId, value]) => ({ auditId: x.a.id!, paramId, value }))));
      await tx.insert(t.acknowledgements).values(part.map((x) => ({ auditId: x.a.id!, at: new Date(x.a.auditDate + 'T12:00:00Z'), auto: true, suggestion: 'Imported' })));
    }
  });
  await logAct(u.id, `Imported ${rows.length} past audits from ${file.name}`);
  revalidatePath('/audits'); return done(summary);
}

export async function undoImport(batchId: string): Promise<Result> {
  const u = await requireUser('import');
  const rows = await db.select({ id: t.audits.id, clientId: t.audits.clientId }).from(t.audits).where(eq(t.audits.importBatchId, batchId));
  const sc = await scopeOf(u); if (rows.some((r) => !inScope(sc, r.clientId))) return fail('This import includes audits of a client outside your scope.');
  const ids = rows.map((x) => x.id);
  await db.transaction(async (tx) => {
    for (const id of ids) { await tx.delete(t.answers).where(eq(t.answers.auditId, id)); await tx.delete(t.acknowledgements).where(eq(t.acknowledgements.auditId, id)); }
    await tx.delete(t.audits).where(eq(t.audits.importBatchId, batchId));
    await tx.delete(t.users).where(eq(t.users.importBatchId, batchId));
    await tx.delete(t.importBatches).where(eq(t.importBatches.id, batchId));
  });
  await logAct(u.id, `Undid import batch (${ids.length} audits)`); revalidatePath('/admin/import'); return done();
}
