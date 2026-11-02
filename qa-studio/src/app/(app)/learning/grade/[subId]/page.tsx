import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, schema as t } from '@/db';
import { requireUser } from '@/lib/auth';
import { canGradeQuiz } from '@/lib/rbac';
import { getUsers, nameOf } from '@/lib/data';
import { fdt } from '@/lib/dates';
import { PageHead } from '@/components/ui';
import GradeForm from './GradeForm';
export default async function Grade({ params }: { params: { subId: string } }) {
  const u = await requireUser('quiz.grade');
  const [s] = await db.select().from(t.quizSubmissions).where(eq(t.quizSubmissions.id, params.subId)); if (!s) notFound();
  const [it] = await db.select().from(t.learningItems).where(eq(t.learningItems.id, s.itemId)); if (!it?.quiz || !canGradeQuiz(u, it)) notFound();
  const users = await getUsers();
  return (<><PageHead eyebrow={`Quiz grading · ${it.title}`} title={nameOf(users, s.agentId)} sub={`Submitted ${fdt(s.at)}. Objective questions are scored from the answer key; set points for the written answers. You can also override any automatic score.`} />
    <GradeForm subId={s.id} itemId={it.id} quiz={it.quiz} answers={s.answers} auto={s.auto} manual={s.manual} /></>);
}
