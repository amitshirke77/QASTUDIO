import Link from 'next/link';
import { db, schema as t } from '@/db';
import type { Filters } from '@/lib/data';
import type { SessionUser } from '@/lib/rbac';
import { quizStats } from '@/lib/quiz';
import { Kpi, pct, scls } from '@/components/ui';

export async function LearningCard({ u, f }: { u: SessionUser; f: Filters }) {
  const [items, asg, subs, users] = await Promise.all([db.select().from(t.learningItems), db.select().from(t.learningAssignments), db.select().from(t.quizSubmissions), db.select().from(t.users)]);
  const scope = new Set(users.filter((x) => x.role === 'agent' && (u.role !== 'tl' || x.tlId === u.id) && (!f.agent || x.id === f.agent)).map((x) => x.id));
  const inR = items.filter((i) => i.publishedAt && i.status !== 'Draft' && i.publishedAt.toISOString().slice(0, 10) >= f.from && i.publishedAt.toISOString().slice(0, 10) <= f.to);
  const A = asg.filter((a) => inR.some((i) => i.id === a.itemId) && scope.has(a.agentId));
  const n = A.length, op = A.filter((a) => a.openedAt).length, ac = A.filter((a) => a.acceptedAt).length;
  const qs = quizStats(subs.filter((s) => inR.some((i) => i.id === s.itemId) && scope.has(s.agentId)));
  return (
    <div className="card" style={{ marginTop: 14 }}><div className="fb-sum-hd"><div><h3>Learning &amp; briefings</h3><p className="muted small" style={{ margin: '2px 0 0' }}>JIT trainings, briefing notes and quizzes published in this date range.</p></div><Link className="btn sm" href="/learning">Open Learning</Link></div>
      <div className="kpis" style={{ margin: 0 }}>
        <Kpi label="Published" value={inR.length} sub={`${inR.filter((i) => i.type === 'JIT').length} JIT · ${inR.filter((i) => i.type === 'Briefing').length} briefings`} />
        <Kpi label="Opened" value={pct(n ? (op / n) * 100 : null)} /><Kpi label="Accepted" value={pct(n ? (ac / n) * 100 : null)} cls={scls(n ? (ac / n) * 100 : null)} />
        <Kpi label="Quiz average" value={pct(qs.avg)} cls={scls(qs.avg)} sub={`${pct(qs.pass)} passed${qs.awaiting ? ' · ' + qs.awaiting + ' to grade' : ''}`} />
      </div></div>
  );
}
