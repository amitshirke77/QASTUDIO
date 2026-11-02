'use server';
import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db, schema as t } from '@/db';
import { requireUser } from '@/lib/auth';
import { getForm } from '@/lib/data';
import { scoreOf } from '@/lib/scoring';
import { mode, auditorAgreement } from '@/lib/calibration';
import { notify, logAct } from '@/lib/notify';
import { uid } from '@/lib/util';
import { done, fail, zErr, type Result } from './_util';

const NewZ = z.object({ title: z.string().trim().min(3).max(120), formId: z.string(), due: z.string().optional(), participants: z.array(z.string()).min(2, 'Pick at least two participants'), items: z.array(z.object({ auditId: z.string().nullable(), caseId: z.string().min(1), link: z.string().optional() })).min(1, 'Add at least one interaction').max(5) });
export async function createCalibration(input: z.input<typeof NewZ>): Promise<Result<{ id: string }>> {
  const u = await requireUser('calib.run');
  const p = NewZ.safeParse(input); if (!p.success) return fail(zErr(p.error));
  const d = p.data, id = uid('cs');
  const ok = await db.select().from(t.users).where(inArray(t.users.id, d.participants));
  if (ok.some((x) => !['auditor', 'qalead', 'admin'].includes(x.role))) return fail('Participants must be QA Auditors or QA Leads.');
  await db.insert(t.calibSessions).values({ id, title: d.title, formId: d.formId, due: d.due || null, participants: d.participants, createdBy: u.id });
  await db.insert(t.calibItems).values(d.items.map((x, i) => ({ id: uid('ci'), sessionId: id, ord: i, auditId: x.auditId, caseId: x.caseId, link: x.link || null })));
  await notify(d.participants.filter((x) => x !== u.id), `Calibration "${d.title}": please score ${d.items.length} interaction${d.items.length > 1 ? 's' : ''} blind.`, `/calibration/${id}`);
  await logAct(u.id, `${u.name} started calibration "${d.title}"`);
  revalidatePath('/calibration'); return done({ id });
}

export async function submitCalibScore(sessionId: string, itemId: string, answers: Record<string, 'Y' | 'N' | 'NA'>, note: string): Promise<Result> {
  const u = await requireUser();
  const [cs] = await db.select().from(t.calibSessions).where(eq(t.calibSessions.id, sessionId));
  if (!cs || cs.status !== 'Open') return fail('This session is closed.');
  if (!cs.participants.includes(u.id)) return fail('You are not a participant.');
  const form = await getForm(cs.formId); if (!form) return fail('Form not found.');
  const ps = form.sections.flatMap((s) => s.params); const miss = ps.filter((p) => !answers[p.id] || !p.options.includes(answers[p.id]));
  if (miss.length) return fail(`${miss.length} parameters are not rated.`);
  const sc = scoreOf(form, answers);
  await db.insert(t.calibScores).values({ id: uid('cx'), sessionId, itemId, userId: u.id, answers, overall: sc.overall, actual: sc.actual, fatal: sc.fatal, note: note.slice(0, 1000), submittedAt: new Date() })
    .onConflictDoUpdate({ target: [t.calibScores.itemId, t.calibScores.userId], set: { answers, overall: sc.overall, actual: sc.actual, fatal: sc.fatal, note: note.slice(0, 1000), submittedAt: new Date() } });
  revalidatePath(`/calibration/${sessionId}`); return done();
}

export async function setAgreed(sessionId: string, itemId: string, paramId: string, value: string, note: string): Promise<Result> {
  await requireUser('calib.run');
  const [cs] = await db.select().from(t.calibSessions).where(eq(t.calibSessions.id, sessionId)); if (!cs || cs.status !== 'Open') return fail('Session is closed.');
  if (!['Y', 'N', 'NA', ''].includes(value)) return fail('Invalid rating.');
  if (!value) await db.delete(t.calibAgreed).where(and(eq(t.calibAgreed.itemId, itemId), eq(t.calibAgreed.paramId, paramId)));
  else await db.insert(t.calibAgreed).values({ sessionId, itemId, paramId, value, note }).onConflictDoUpdate({ target: [t.calibAgreed.itemId, t.calibAgreed.paramId], set: { value, note } });
  revalidatePath(`/calibration/${sessionId}`); return done();
}

export async function closeCalibration(sessionId: string, outcome: string): Promise<Result> {
  const u = await requireUser('calib.run');
  const [cs] = await db.select().from(t.calibSessions).where(eq(t.calibSessions.id, sessionId)); if (!cs || cs.status !== 'Open') return fail('Session is already closed.');
  const form = await getForm(cs.formId); if (!form) return fail('Form not found.');
  const params = form.sections.flatMap((s) => s.params.map((p) => ({ id: p.id, name: p.name, section: s.name })));
  const items = await db.select().from(t.calibItems).where(eq(t.calibItems.sessionId, sessionId));
  const scores = await db.select().from(t.calibScores).where(eq(t.calibScores.sessionId, sessionId));
  const agreed = await db.select().from(t.calibAgreed).where(eq(t.calibAgreed.sessionId, sessionId));
  // default missing agreed ratings to the most common rating
  for (const it of items) for (const p of params) {
    if (agreed.some((a) => a.itemId === it.id && a.paramId === p.id)) continue;
    const m = mode(scores.filter((s) => s.itemId === it.id).map((s) => s.answers[p.id]).filter(Boolean));
    if (m.mode) { await db.insert(t.calibAgreed).values({ sessionId, itemId: it.id, paramId: p.id, value: m.mode, note: '' }); agreed.push({ sessionId, itemId: it.id, paramId: p.id, value: m.mode, note: '' }); }
  }
  await db.update(t.calibSessions).set({ status: 'Closed', closedAt: new Date(), outcome: outcome.slice(0, 3000) }).where(eq(t.calibSessions.id, sessionId));
  const pack = items.map((it) => ({ params, scores: scores.filter((s) => s.itemId === it.id), agreed: Object.fromEntries(agreed.filter((a) => a.itemId === it.id).map((a) => [a.paramId, a.value])) }));
  for (const pid of cs.participants) {
    const ag = auditorAgreement(pack, pid);
    await notify(pid, `Calibration "${cs.title}" closed. Your agreement: ${ag == null ? 'not scored' : ag.toFixed(1) + '%'}.`, `/calibration/${sessionId}`);
  }
  await logAct(u.id, `${u.name} closed calibration "${cs.title}"`);
  revalidatePath(`/calibration/${sessionId}`); return done();
}
