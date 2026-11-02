import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db, schema as t } from '@/db';
import { requireRole } from '@/lib/auth';
import { getUsers, nameOf, paramIndex } from '@/lib/data';
import { agentQuizState } from '@/lib/quiz';
import { markOpened } from '@/app/actions/learning';
import { fdate } from '@/lib/dates';
import { PageHead } from '@/components/ui';
import ReadPanel from './ReadPanel';
import { FileList } from '@/components/learning/Attachments';
import { filesFor } from '@/lib/learningFiles';
export default async function Read({ params, searchParams }: { params: { id: string }; searchParams: { quiz?: string } }) {
  const u = await requireRole('agent');
  const [it] = await db.select().from(t.learningItems).where(eq(t.learningItems.id, params.id));
  const [a] = await db.select().from(t.learningAssignments).where(and(eq(t.learningAssignments.itemId, params.id), eq(t.learningAssignments.agentId, u.id)));
  if (!it || !a || it.status === 'Draft') notFound();
  if (!a.openedAt) await markOpened(it.id);
  const subs = (await db.select().from(t.quizSubmissions).where(and(eq(t.quizSubmissions.itemId, it.id), eq(t.quizSubmissions.agentId, u.id)))).sort((x, y) => +x.at - +y.at);
  const st = agentQuizState(it.quiz, !!a.acceptedAt, subs); const last = subs[subs.length - 1];
  const users = await getUsers(), pidx = await paramIndex(); const files = await filesFor(it.id);
  // the agent never receives the answer key unless the author chose to show answers and there is a graded attempt
  const reveal = !!(it.quiz?.showAnswers && last && last.status === 'Scored');
  const qz = it.quiz ? { ...it.quiz, questions: it.quiz.questions.map((q) => ({ ...q, accepted: undefined, options: q.options.map((o) => ({ ...o, correct: reveal ? o.correct : false })) })) } : null;
  const result = last ? Object.fromEntries((it.quiz?.questions || []).filter((q) => q.type !== 'rating' && q.points > 0).map((q) => { const m = last.manual[q.id]; const got = m && m.points != null ? m.points : last.auto[q.id]; return [q.id, { label: got == null ? 'Awaiting grading' : `${got} / ${q.points}`, feedback: m?.feedback }]; })) : undefined;
  return (<><PageHead eyebrow={it.type === 'JIT' ? 'JIT training' : 'Briefing note'} title={it.title} sub={`From ${nameOf(users, it.createdBy)} · ${fdate(it.publishedAt)}${it.due ? ' · accept by ' + fdate(it.due) : ''}`} />
    {files.length > 0 && <section className="card stack" style={{ marginBottom: 14 }}><div><h3>Attachments</h3><p className="muted small" style={{ margin: '2px 0 0' }}>Go through these before you accept.</p></div><FileList files={files} /></section>}
    <ReadPanel itemId={it.id} body={it.body} params={[...new Set(Object.values(pidx).filter((p) => it.params.includes(p.code)).map((p) => p.name))]} accepted={a.acceptedAt ? a.acceptedAt.toISOString() : null} comment={a.comment} isJit={it.type === 'JIT'}
      quiz={qz} state={st} last={last ? { status: last.status, score: last.score, max: last.max, pct: last.pct, passed: last.passed, answers: last.answers } : null} result={result} startQuiz={searchParams.quiz === '1'} /></>);
}
