'use server';
import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db, schema as t } from '@/db';
import type { Quiz } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { canGradeQuiz } from '@/lib/rbac';
import { audienceAgents } from '@/lib/audience';
import { autoScore, finalScore, validateQuiz, missingRequired, isScored, suggestQuestions } from '@/lib/quiz';
import { notify, logAct } from '@/lib/notify';
import { uid } from '@/lib/util';
import { fdate } from '@/lib/dates';
import { done, fail, zErr, type Result } from './_util';
import { syncFiles } from '@/lib/learningFiles';
import { scopedUserIds } from '@/lib/scope';

const QuestionZ = z.object({ id: z.string(), type: z.enum(['single', 'multi', 'tf', 'short', 'long', 'rating']), text: z.string().max(1000), required: z.boolean(), points: z.number().min(0).max(50), options: z.array(z.object({ id: z.string(), text: z.string().max(500), correct: z.boolean() })).max(10), accepted: z.string().max(2000).optional() });
const QuizZ = z.object({ enabled: z.boolean(), passPct: z.number().min(0).max(100), attempts: z.number().int().min(1).max(5), showAnswers: z.boolean(), questions: z.array(QuestionZ).max(40) });
const ItemZ = z.object({
  id: z.string().optional(), type: z.enum(['JIT', 'Briefing']), title: z.string().max(200), body: z.string().max(20000), params: z.array(z.string()).max(40),
  audience: z.object({ kind: z.enum(['all', 'lob', 'team', 'agents', 'missed']), value: z.string().optional(), agents: z.array(z.string()).optional(), params: z.array(z.string()).optional(), days: z.number().optional() }),
  due: z.string().optional().nullable(), quiz: QuizZ.nullable(), files: z.array(z.string()).max(10).optional(),
});
export type ItemInput = z.infer<typeof ItemZ>;

export async function previewAudience(aud: ItemInput['audience'], params: string[]) {
  const u = await requireUser('learning.create');
  const ids = await scopedUserIds(u);
  const a = (await audienceAgents(aud.kind === 'missed' ? { ...aud, params } : aud)).filter((x) => !ids || ids.has(x.id));
  return a.map((x) => ({ id: x.id, name: x.name }));
}

export async function saveLearning(input: ItemInput, publish: boolean): Promise<Result<{ id: string }>> {
  const u = await requireUser('learning.create');
  const p = ItemZ.safeParse(input); if (!p.success) return fail(zErr(p.error));
  const d = p.data;
  if (!d.title.trim()) return fail('Give it a title.');
  const aud = d.audience.kind === 'missed' ? { ...d.audience, params: d.params } : d.audience;
  const quiz: Quiz | null = d.quiz && d.quiz.enabled ? d.quiz : null;
  let recips: { id: string }[] = [];
  if (publish) {
    if (!d.body.trim()) return fail('Write the content before publishing.');
    if (aud.kind === 'missed' && !d.params.length) return fail('Tick at least one linked parameter to target agents who missed it.');
    const ids = await scopedUserIds(u); recips = (await audienceAgents(aud)).filter((x) => !ids || ids.has(x.id));
    if (!recips.length) return fail('No agents match this audience.');
    if (quiz) { const e = validateQuiz(quiz); if (e) return fail('Quiz: ' + e); }
  }
  let id = d.id;
  if (id) {
    const [ex] = await db.select().from(t.learningItems).where(eq(t.learningItems.id, id));
    if (!ex) return fail('Not found.'); if (ex.status !== 'Draft') return fail('Only drafts can be edited.');
    if (ex.createdBy !== u.id && !['admin', 'qalead', 'manager'].includes(u.role)) return fail('Only the author can edit this draft.');
  }
  const row = { type: d.type, title: d.title.trim(), body: d.body, params: d.params, audience: aud, due: d.due || null, quiz, status: publish ? 'Published' : 'Draft', publishedAt: publish ? new Date() : null };
  if (id) await db.update(t.learningItems).set(row).where(eq(t.learningItems.id, id));
  else { id = uid('ln'); await db.insert(t.learningItems).values({ id, createdBy: u.id, ...row }); }
  if (d.files) await syncFiles(id!, d.files, u.id);
  if (publish) {
    await db.insert(t.learningAssignments).values(recips.map((a) => ({ itemId: id!, agentId: a.id })));
    await notify(recips.map((a) => a.id), `New ${d.type === 'JIT' ? 'JIT training' : 'briefing note'}: ${row.title}${row.due ? ' · accept by ' + fdate(row.due) : ''}${quiz ? ' · includes a quiz' : ''}`, `/me/learning/${id}`);
  }
  await logAct(u.id, `${publish ? 'Published' : 'Saved draft'} ${d.type} "${row.title}"${publish ? ` to ${recips.length} agents` : ''}`);
  revalidatePath('/learning'); return done({ id: id! });
}

export async function suggestQuiz(paramCodes: string[]) {
  await requireUser('learning.create');
  if (!paramCodes.length) return [];
  const ps = await db.select().from(t.params).where(inArray(t.params.code, paramCodes));
  const forms = await db.select().from(t.forms);
  const seen = new Set<string>(); const uniq = ps.filter((p) => !seen.has(p.code) && seen.add(p.code));
  return suggestQuestions(uniq.map((p) => ({ code: p.code, name: p.name, channel: forms.find((f) => f.id === p.formId)?.channel || 'Call', options: p.options, fatal: p.fatal, weight: p.weight, guideY: p.guideY, guideN: p.guideN, guideNA: p.guideNA })));
}

export async function archiveLearning(id: string): Promise<Result> {
  const u = await requireUser('learning.create');
  const [it] = await db.select().from(t.learningItems).where(eq(t.learningItems.id, id)); if (!it) return fail('Not found.');
  if (it.createdBy !== u.id && !['admin', 'qalead', 'manager'].includes(u.role)) return fail('Only the author can archive this.');
  await db.update(t.learningItems).set({ status: 'Archived' }).where(eq(t.learningItems.id, id)); revalidatePath('/learning'); return done();
}
export async function remindLearning(id: string): Promise<Result<{ n: number }>> {
  await requireUser('learning.create');
  const [it] = await db.select().from(t.learningItems).where(eq(t.learningItems.id, id)); if (!it) return fail('Not found.');
  const pend = (await db.select().from(t.learningAssignments).where(eq(t.learningAssignments.itemId, id))).filter((a) => !a.acceptedAt);
  await notify(pend.map((a) => a.agentId), `Reminder: please read and accept "${it.title}"${it.due ? ' by ' + fdate(it.due) : ''}.`, `/me/learning/${id}`);
  return done({ n: pend.length });
}

/* ---------- agent side ---------- */
export async function markOpened(itemId: string) {
  const u = await requireUser('learning.take');
  await db.update(t.learningAssignments).set({ openedAt: new Date() }).where(and(eq(t.learningAssignments.itemId, itemId), eq(t.learningAssignments.agentId, u.id)));
}
export async function acceptLearning(itemId: string, confirmed: boolean, comment: string): Promise<Result> {
  const u = await requireUser('learning.take');
  if (!confirmed) return fail('Tick the box to confirm you have read and understood it.');
  const [a] = await db.select().from(t.learningAssignments).where(and(eq(t.learningAssignments.itemId, itemId), eq(t.learningAssignments.agentId, u.id)));
  if (!a) return fail('This was not sent to you.'); if (a.acceptedAt) return done();
  await db.update(t.learningAssignments).set({ acceptedAt: new Date(), openedAt: a.openedAt || new Date(), comment: comment.slice(0, 1000) }).where(and(eq(t.learningAssignments.itemId, itemId), eq(t.learningAssignments.agentId, u.id)));
  const [it] = await db.select().from(t.learningItems).where(eq(t.learningItems.id, itemId));
  if (comment.trim() && it) await notify(it.createdBy, `${u.name} accepted "${it.title}" with a comment: ${comment.slice(0, 120)}`, `/learning/${itemId}`);
  revalidatePath(`/me/learning/${itemId}`); return done();
}

export async function submitQuiz(itemId: string, answers: Record<string, unknown>): Promise<Result<{ status: string; pct: number | null; passed: boolean | null }>> {
  const u = await requireUser('learning.take');
  const [it] = await db.select().from(t.learningItems).where(eq(t.learningItems.id, itemId));
  const qz = it?.quiz; if (!it || !qz || !qz.enabled) return fail('No quiz for this item.');
  const [a] = await db.select().from(t.learningAssignments).where(and(eq(t.learningAssignments.itemId, itemId), eq(t.learningAssignments.agentId, u.id)));
  if (!a) return fail('This was not sent to you.'); if (!a.acceptedAt) return fail('Accept the training before taking the quiz.');
  const subs = await db.select().from(t.quizSubmissions).where(and(eq(t.quizSubmissions.itemId, itemId), eq(t.quizSubmissions.agentId, u.id)));
  if (subs.some((s) => s.status === 'Awaiting grading')) return fail('Your last attempt is still being graded.');
  if (subs.some((s) => s.passed)) return fail('You have already passed this quiz.');
  if (subs.length >= qz.attempts) return fail('No attempts left.');
  const miss = missingRequired(qz, answers); if (miss.length) return fail('Answer the required questions: ' + miss.join(', ') + '.');
  const clean: Record<string, unknown> = {}; const auto: Record<string, number | null> = {};
  for (const q of qz.questions) {
    let v = answers[q.id];
    if (q.type === 'multi') v = Array.isArray(v) ? (v as unknown[]).map(String).filter((x) => q.options.some((o) => o.id === x)) : [];
    else if (q.type === 'single' || q.type === 'tf') v = q.options.some((o) => o.id === v) ? v : null;
    else if (q.type === 'rating') v = Math.max(0, Math.min(5, Math.round(+(v as number) || 0)));
    else v = String(v ?? '').slice(0, 5000);
    clean[q.id] = v; auto[q.id] = autoScore(q, v);
  }
  const f = finalScore(qz, auto, {});
  await db.insert(t.quizSubmissions).values({ id: uid('qs'), itemId, agentId: u.id, at: new Date(), answers: clean, auto, manual: {}, score: f.score, max: f.max, pct: f.pct, passed: f.passed, status: f.status });
  if (f.status === 'Awaiting grading') await notify(it.createdBy, `${u.name} submitted the quiz for "${it.title}". Written answers need grading.`, '/learning?tab=grading');
  await logAct(u.id, `${u.name} submitted the quiz for "${it.title}" (${f.status === 'Scored' ? f.pct?.toFixed(1) + '%' : 'awaiting grading'})`);
  revalidatePath(`/me/learning/${itemId}`); return done({ status: f.status, pct: f.pct, passed: f.passed });
}

export async function gradeSubmission(subId: string, manual: Record<string, { points: number | null; feedback: string }>): Promise<Result> {
  const u = await requireUser('quiz.grade');
  const [s] = await db.select().from(t.quizSubmissions).where(eq(t.quizSubmissions.id, subId)); if (!s) return fail('Submission not found.');
  const [it] = await db.select().from(t.learningItems).where(eq(t.learningItems.id, s.itemId)); if (!it?.quiz) return fail('Quiz not found.');
  if (!canGradeQuiz(u, it)) return fail('You can grade only quizzes on items you created.');
  const errs: string[] = []; const m: typeof manual = {};
  it.quiz.questions.forEach((q, k) => {
    if (!isScored(q)) return;
    const x = manual[q.id]; const has = x && x.points != null && !isNaN(+x.points);
    if (has && (+x.points! < 0 || +x.points! > q.points)) errs.push(`question ${k + 1} must be between 0 and ${q.points}`);
    if (!has && s.auto[q.id] == null) errs.push(`points for question ${k + 1}`);
    if (x && (has || x.feedback)) m[q.id] = { points: has ? +x.points! : null, feedback: String(x.feedback || '').slice(0, 1000) };
  });
  if (errs.length) return fail('Add ' + errs.join('; ') + '.');
  const f = finalScore(it.quiz, s.auto, m);
  await db.update(t.quizSubmissions).set({ manual: m, score: f.score, max: f.max, pct: f.pct, passed: f.passed, status: f.status, gradedBy: u.id, gradedAt: new Date() }).where(eq(t.quizSubmissions.id, subId));
  await notify(s.agentId, `Your quiz for "${it.title}" was graded: ${f.pct?.toFixed(1)}% (${f.passed ? 'passed' : 'not passed'}).`, `/me/learning/${it.id}`);
  await logAct(u.id, `${u.name} graded a quiz for "${it.title}" (${f.pct?.toFixed(1)}%)`);
  revalidatePath(`/learning/${it.id}`); return done();
}
