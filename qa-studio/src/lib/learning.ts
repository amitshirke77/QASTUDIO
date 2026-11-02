import { db, schema as t } from '@/db';
import { canGradeQuiz, type SessionUser } from './rbac';
import { today } from './dates';
export async function learningAll() {
  const [items, asg, subs] = await Promise.all([db.select().from(t.learningItems), db.select().from(t.learningAssignments), db.select().from(t.quizSubmissions)]);
  return { items, asg, subs };
}
export function itemStats(asg: { itemId: string; agentId: string; openedAt: Date | null; acceptedAt: Date | null }[], it: { id: string; due: string | null }) {
  const a = asg.filter((x) => x.itemId === it.id), n = a.length, op = a.filter((x) => x.openedAt).length, ac = a.filter((x) => x.acceptedAt).length;
  const onTime = a.filter((x) => x.acceptedAt && (!it.due || x.acceptedAt.toISOString().slice(0, 10) <= it.due)).length;
  const overdue = it.due && it.due < today() ? n - ac : 0;
  const hrs = a.filter((x) => x.acceptedAt).map((x) => +x.acceptedAt!); 
  return { n, op, ac, onTime, overdue, acP: n ? (ac / n) * 100 : null, opP: n ? (op / n) * 100 : null, otP: n ? (onTime / n) * 100 : null, hrs };
}
export async function gradingQueue(u: SessionUser) {
  const { items, subs } = await learningAll();
  return subs.filter((s) => s.status === 'Awaiting grading').map((s) => ({ s, i: items.find((i) => i.id === s.itemId)! })).filter((x) => x.i && canGradeQuiz(u, x.i));
}
