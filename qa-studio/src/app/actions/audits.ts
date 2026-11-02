'use server';
import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db, schema as t } from '@/db';
import { requireUser } from '@/lib/auth';
import { can, canAuditAgent, canResolveDispute, canViewAudit, type SessionUser } from '@/lib/rbac';
import { scoreOf } from '@/lib/scoring';
import { weekEnding, monthLabel, today } from '@/lib/dates';
import { getForm, getSetting } from '@/lib/data';
import { scopeOf, inScope, clientOfCustomer } from '@/lib/scope';
import { notify, logAct } from '@/lib/notify';
import { uid } from '@/lib/util';
import { done, fail, zDate, zErr, type Result } from './_util';

const AuditIn = z.object({
  agentId: z.string().min(1, 'Agent is required'), caseId: z.string().trim().min(1, 'Case ID is required').max(60),
  auditDate: zDate, interactionDate: zDate, customer: z.string().min(1, 'Customer is required'), product: z.string().min(1), lob: z.string().min(1),
  formId: z.string().min(1), auditorId: z.string().min(1, 'Name of QA is required'), tlId: z.string().min(1, 'Name of TL is required'),
  phone: z.string().max(20).optional().default(''), link: z.string().max(1000).optional().default(''), observations: z.string().max(5000).default(''),
  answers: z.record(z.enum(['Y', 'N', 'NA'])), aois: z.array(z.object({ paramId: z.string().nullable(), text: z.string().max(2000) })).max(60),
  allocationId: z.string().optional().nullable(),
});
export type AuditInput = z.input<typeof AuditIn>;

export async function createAudit(input: AuditInput): Promise<Result<{ id: string }>> {
  const u = await requireUser('audit.create');
  const p = AuditIn.safeParse(input); if (!p.success) return fail(zErr(p.error));
  const d = p.data;
  const [agent] = await db.select().from(t.users).where(eq(t.users.id, d.agentId));
  if (!canAuditAgent(u, agent)) return fail(u.role === 'tl' ? 'Team Leaders can audit only the agents mapped to them.' : 'You cannot audit this agent.');
  const scope = await scopeOf(u); if (!inScope(scope, agent!.clientId)) return fail('This agent is outside the clients you can audit.');
  const clientId = await clientOfCustomer(d.customer, agent!.clientId);
  if (!clientId || !inScope(scope, clientId)) return fail('Pick a customer of a client you can audit.');
  if (agent!.clientId && clientId !== agent!.clientId) return fail(`${d.customer} is not a customer of this agent's client.`);
  const [auditor] = await db.select().from(t.users).where(eq(t.users.id, d.auditorId));
  if (!auditor || !(['auditor', 'qalead', 'admin'].includes(auditor.role) || (u.role === 'tl' && auditor.id === u.id))) return fail('Name of QA must be a QA Auditor, QA Lead or Admin.');
  if (u.role === 'tl' && d.auditorId !== u.id) return fail('A Team Leader records audits under their own name.');
  const form = await getForm(d.formId);
  if (!form || form.status !== 'Active' || !form.lobs.includes(d.lob)) return fail('That form is not active for this LOB.');
  if (d.lob !== agent!.lob) return fail(`This agent is in ${agent!.lob}.`);
  if (d.interactionDate > d.auditDate) return fail('The interaction date cannot be after the audit date.');
  if (d.auditDate > today()) return fail('The audit date cannot be in the future.');
  const params = form.sections.flatMap((s) => s.params);
  const missing = params.filter((x) => !d.answers[x.id]);
  if (missing.length) return fail(`${missing.length} parameters are not rated.`);
  const bad = params.filter((x) => !x.options.includes(d.answers[x.id]));
  if (bad.length) return fail(`Invalid rating for: ${bad.map((x) => x.name).join(', ')}`);
  const bp = await getSetting<Record<string, { status: string }>>('bp', {});
  if (bp.aoiForN?.status === 'approved') {
    const miss = params.filter((x) => d.answers[x.id] === 'N' && !d.aois.some((a) => a.paramId === x.id && a.text.trim()));
    if (miss.length) return fail('Add an area of improvement for: ' + miss.map((x) => x.name).join(', '));
  }
  const sc = scoreOf(form, d.answers);
  const id = uid('AU');
  await db.transaction(async (tx) => {
    await tx.insert(t.audits).values({ id, caseId: d.caseId, agentId: d.agentId, auditorId: d.auditorId, tlId: agent!.tlId || d.tlId, formId: d.formId, channel: form.channel, lob: d.lob, product: d.product, customer: d.customer, clientId, auditDate: d.auditDate, weekEnding: weekEnding(d.auditDate), month: monthLabel(d.auditDate), interactionDate: d.interactionDate, phone: d.phone || null, link: d.link || null, observations: d.observations, overall: sc.overall, actual: sc.actual, fatal: sc.fatal, allocationId: d.allocationId || null });
    await tx.insert(t.answers).values(params.map((x) => ({ auditId: id, paramId: x.id, value: d.answers[x.id] })));
    const ao = d.aois.filter((a) => a.text.trim()); if (ao.length) await tx.insert(t.aois).values(ao.map((a) => ({ id: uid('x'), auditId: id, paramId: a.paramId, text: a.text.trim() })));
    if (d.allocationId) await tx.update(t.allocations).set({ status: 'Done', auditId: id }).where(eq(t.allocations.id, d.allocationId));
  });
  await notify([d.agentId, agent!.tlId || ''], `New ${form.channel.toLowerCase()} audit ${d.caseId}: ${sc.actual.toFixed(1)}% actual${sc.fatal ? ' (fatal)' : ''}. Review and acknowledge.`, `/audits/${id}`);
  await logAct(u.id, `${u.name} submitted audit ${d.caseId} for ${agent!.name} (${sc.actual.toFixed(1)}%)`);
  revalidatePath('/audits'); return done({ id });
}

async function loadFor(u: SessionUser, auditId: string) { const [a] = await db.select().from(t.audits).where(eq(t.audits.id, auditId)); return a && inScope(await scopeOf(u), a.clientId) ? a : undefined; }

export async function acknowledge(auditId: string, suggestion: string): Promise<Result> {
  const u = await requireUser('audit.acknowledge');
  const a = await loadFor(u, auditId); if (!a || a.agentId !== u.id) return fail('Audit not found.');
  if (!['Pending acknowledgement', 'Dispute resolved'].includes(a.status)) return fail('This audit is already ' + a.status.toLowerCase() + '.');
  await db.insert(t.acknowledgements).values({ auditId, at: new Date(), auto: false, suggestion: suggestion.slice(0, 2000) }).onConflictDoUpdate({ target: t.acknowledgements.auditId, set: { at: new Date(), suggestion: suggestion.slice(0, 2000), auto: false } });
  await db.update(t.audits).set({ status: 'Acknowledged' }).where(eq(t.audits.id, auditId));
  await notify(a.auditorId, `${u.name} acknowledged audit ${a.caseId}${suggestion ? ' with a suggestion' : ''}.`, `/audits/${auditId}`);
  revalidatePath(`/audits/${auditId}`); return done();
}

export async function raiseDispute(auditId: string, paramIds: string[], reason: string): Promise<Result> {
  const u = await requireUser('audit.acknowledge');
  const a = await loadFor(u, auditId); if (!a || a.agentId !== u.id) return fail('Audit not found.');
  if (a.status !== 'Pending acknowledgement') return fail('You can dispute only an audit waiting for your acknowledgement.');
  const win = (await getSetting<Record<string, { status: string; value?: number }>>('bp', {})).disputeWindow;
  if (win?.status === 'approved' && Date.now() - +a.createdAt > (+(win.value || 72)) * 3600e3) return fail(`The ${win.value} hour dispute window has passed.`);
  if (!paramIds.length) return fail('Pick at least one parameter you disagree with.');
  if (reason.trim().length < 10) return fail('Explain the reason (at least 10 characters).');
  const valid = await db.select().from(t.answers).where(and(eq(t.answers.auditId, auditId), inArray(t.answers.paramId, paramIds)));
  if (valid.length !== paramIds.length) return fail('Invalid parameters.');
  await db.insert(t.disputes).values({ id: uid('dp'), auditId, paramIds, reason: reason.trim().slice(0, 3000), raisedAt: new Date() });
  await db.update(t.audits).set({ status: 'Disputed' }).where(eq(t.audits.id, auditId));
  const leads = await db.select({ id: t.users.id }).from(t.users).where(and(eq(t.users.role, 'qalead'), eq(t.users.active, true)));
  await notify([a.auditorId, ...leads.map((x) => x.id)], `${u.name} disputed audit ${a.caseId}.`, `/audits/${auditId}`);
  revalidatePath(`/audits/${auditId}`); return done();
}

export async function resolveDispute(auditId: string, outcome: 'Upheld' | 'Rejected' | 'Partially upheld', note: string, revised: Record<string, 'Y' | 'N' | 'NA'>): Promise<Result> {
  const u = await requireUser('dispute.resolve');
  const a = await loadFor(u, auditId); if (!a) return fail('Audit not found.');
  if (!canResolveDispute(u, a)) return fail('You can resolve disputes only on audits you did.');
  if (a.status !== 'Disputed') return fail('There is no open dispute.');
  if (!['Upheld', 'Rejected', 'Partially upheld'].includes(outcome)) return fail('Pick an outcome.');
  if (!note.trim()) return fail('Add a resolution note for the agent.');
  const [dp] = await db.select().from(t.disputes).where(and(eq(t.disputes.auditId, auditId))).orderBy(t.disputes.raisedAt);
  const form = await getForm(a.formId); if (!form || !dp) return fail('Dispute not found.');
  await db.transaction(async (tx) => {
    if (outcome !== 'Rejected') {
      for (const [pid, v] of Object.entries(revised)) {
        if (!dp.paramIds.includes(pid)) continue;
        await tx.update(t.answers).set({ value: v }).where(and(eq(t.answers.auditId, auditId), eq(t.answers.paramId, pid)));
      }
      const ans = await tx.select().from(t.answers).where(eq(t.answers.auditId, auditId));
      const sc = scoreOf(form, Object.fromEntries(ans.map((x) => [x.paramId, x.value])));
      await tx.update(t.audits).set({ overall: sc.overall, actual: sc.actual, fatal: sc.fatal }).where(eq(t.audits.id, auditId));
    }
    await tx.update(t.disputes).set({ outcome, note: note.trim(), resolvedBy: u.id, resolvedAt: new Date() }).where(eq(t.disputes.id, dp.id));
    await tx.update(t.audits).set({ status: 'Dispute resolved' }).where(eq(t.audits.id, auditId));
  });
  await notify(a.agentId, `Your dispute on audit ${a.caseId} was ${outcome.toLowerCase()}. Please acknowledge the outcome.`, `/audits/${auditId}`);
  await logAct(u.id, `${u.name} resolved the dispute on ${a.caseId}: ${outcome}`);
  revalidatePath(`/audits/${auditId}`); return done();
}

export async function logFeedback(auditId: string, mode: string, note: string): Promise<Result> {
  const u = await requireUser('feedback.log');
  const a = await loadFor(u, auditId); if (!a || !canViewAudit(u, a)) return fail('Audit not found.');
  if (!['One-to-one', 'Teams call', 'Huddle', 'Floor'].includes(mode)) return fail('Pick how the feedback was given.');
  await db.insert(t.feedbackSessions).values({ id: uid('fb'), auditId, at: new Date(), by: u.id, mode, note: note.slice(0, 2000) });
  await notify(a.agentId, `Feedback on audit ${a.caseId} was logged by ${u.name}. Please acknowledge or dispute.`, `/audits/${auditId}`);
  revalidatePath(`/audits/${auditId}`); revalidatePath('/tracker'); return done();
}

export async function sendReminder(auditId: string): Promise<Result> {
  const u = await requireUser('feedback.remind');
  const a = await loadFor(u, auditId); if (!a || !canViewAudit(u, a)) return fail('Audit not found.');
  const fb = await db.select().from(t.feedbackSessions).where(eq(t.feedbackSessions.auditId, auditId)).limit(1);
  const to = a.status === 'Disputed' ? a.auditorId : a.status === 'Pending acknowledgement' && !fb.length ? a.auditorId : a.agentId;
  const txt = a.status === 'Disputed' ? `Reminder: the dispute on ${a.caseId} is waiting for resolution.` : to === a.auditorId ? `Reminder: feedback on ${a.caseId} has not been delivered yet.` : `Reminder: please acknowledge or dispute audit ${a.caseId}.`;
  await db.insert(t.reminders).values({ id: uid('rm'), auditId, at: new Date(), by: u.id, toUserId: to });
  await notify(to, txt, `/audits/${auditId}`); return done();
}

