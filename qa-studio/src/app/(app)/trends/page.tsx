import { db, schema as t } from '@/db';
import { requireUser } from '@/lib/auth';
import { applyFilters, getUsers, loadAudits, parseFilters, type AuditX } from '@/lib/data';
import { filterOptions } from '@/lib/filters';
import { series, type Gran } from '@/lib/analytics';
import { groupBy, avg } from '@/lib/util';
import { MON, fdate, weekEnding, addDays, today } from '@/lib/dates';
import { FilterBar, Seg } from '@/components/client';
import QChart from '@/components/Charts';
import { PageHead } from '@/components/ui';

export default async function Trends({ searchParams }: { searchParams: Record<string, string> }) {
  const u = await requireUser();
  const f = parseFilters({ from: addDays(today(), -180), ...searchParams });
  const gran = (searchParams.gran === 'month' ? 'month' : 'week') as Gran;
  const users = await getUsers(), opts = await filterOptions(u, users);
  const keyOf = (d: string) => (gran === 'week' ? weekEnding(d) : d.slice(0, 7));
  const label = (k: string) => (gran === 'week' ? 'WE ' + fdate(k).slice(0, -5) : MON[+k.slice(5, 7) - 1] + ' ' + k.slice(2, 4));
  let A: AuditX[], team: AuditX[] = [];
  if (u.role === 'agent') {
    A = applyFilters(await loadAudits(u, f.from, f.to), f);
    const me = users.find((x) => x.id === u.id); const mates = new Set(users.filter((x) => x.tlId === me?.tlId).map((x) => x.id));
    team = applyFilters(await loadAudits({ ...u, role: 'qalead' }, f.from, f.to), f).filter((a) => mates.has(a.agentId));
  } else A = applyFilters(await loadAudits(u, f.from, f.to, { by: f.by }), f);
  const s = series(A, gran);
  const keys = [...new Set([...A, ...team].map((a) => keyOf(a.auditDate)))].sort();
  const at = (arr: AuditX[], k: string, fn: (v: AuditX[]) => number | null) => { const v = arr.filter((a) => keyOf(a.auditDate) === k); return v.length ? fn(v) : null; };
  const lobs = ['Tripstacc', 'Shopstacc'];
  const auditors = [...groupBy(A, (a) => a.auditorId).keys()];
  // quiz trend
  const subs = u.role === 'client' ? [] : (await db.select().from(t.quizSubmissions)).filter((x) => x.status === 'Scored' && (u.role !== 'agent' || x.agentId === u.id) && x.at.toISOString().slice(0, 10) >= f.from && x.at.toISOString().slice(0, 10) <= f.to);
  const qk = [...groupBy(subs, (x) => keyOf(x.at.toISOString().slice(0, 10))).entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return (<>
    <PageHead title={u.role === 'agent' ? 'My trends' : 'Trends'} sub={`${f.from} to ${f.to}`} actions={<Seg k="gran" def="week" opts={[['week', 'Weekly'], ['month', 'Monthly']]} />} />
    <FilterBar {...opts} from={f.from} to={f.to} />
    <div className="grid g2">
      <div className="card chart-card" style={{ gridColumn: '1/-1' }}><div className="hd"><h3>{u.role === 'agent' ? 'My Actual vs my team' : 'Actual and Overall'}</h3></div>
        {u.role === 'agent' ? <QChart labels={keys.map(label)} sets={[{ label: 'My Actual', data: keys.map((k) => at(A, k, (v) => avg(v.map((a) => a.actual)))), color: 0, fill: true }, { label: 'My Overall', data: keys.map((k) => at(A, k, (v) => avg(v.map((a) => a.overall)))), color: 1, dashed: true }, { label: 'Team Actual', data: keys.map((k) => at(team, k, (v) => avg(v.map((a) => a.actual)))), color: 2 }]} />
          : <QChart labels={s.labels} sets={[{ label: 'Actual', data: s.actual, color: 0, fill: true }, { label: 'Overall', data: s.overall, color: 1, dashed: true }, { label: 'Audits', data: s.n, type: 'bar', axis: 'y1', color: 2 }]} />}</div>
      <div className="card chart-card"><div className="hd"><h3>Fatal rate</h3><span className="muted small">% of audits with a fatal No</span></div><QChart pct={false} labels={s.labels} sets={[{ label: 'Fatal rate %', data: s.fatalRate.map((x) => +x.toFixed(1)), color: 5 }]} /></div>
      {u.role !== 'agent' && <div className="card chart-card"><div className="hd"><h3>By LOB</h3><span className="muted small">Actual quality</span></div><QChart labels={keys.map(label)} sets={lobs.map((l, i) => ({ label: l, data: keys.map((k) => at(A.filter((a) => a.lob === l), k, (v) => avg(v.map((a) => a.actual)))), color: i * 2 }))} /></div>}
      <div className="card chart-card"><div className="hd"><h3>Calls vs emails</h3><span className="muted small">Actual quality</span></div><QChart labels={keys.map(label)} sets={['Call', 'Email'].map((c, i) => ({ label: c, data: keys.map((k) => at(A.filter((a) => a.channel === c), k, (v) => avg(v.map((a) => a.actual)))), color: i + 2 }))} /></div>
      {!['agent', 'client'].includes(u.role) && <div className="card chart-card"><div className="hd"><h3>Audits by auditor</h3></div><QChart type="bar" pct={false} stacked labels={keys.map(label)} sets={auditors.map((id, i) => ({ label: users.find((x) => x.id === id)?.name || id, data: keys.map((k) => A.filter((a) => a.auditorId === id && keyOf(a.auditDate) === k).length), color: i }))} /></div>}
      {u.role !== 'client' && <div className="card chart-card"><div className="hd"><h3>Quiz scores</h3><span className="muted small">Average score and pass rate of graded attempts</span></div><QChart labels={qk.map(([k]) => label(k))} sets={[{ label: 'Average score', data: qk.map(([, v]) => avg(v.map((x) => x.pct ?? 0))), color: 0 }, { label: 'Pass rate', data: qk.map(([, v]) => (v.filter((x) => x.passed).length / v.length) * 100), color: 1, dashed: true }, { label: 'Attempts', data: qk.map(([, v]) => v.length), type: 'bar', axis: 'y1', color: 2 }]} /></div>}
    </div>
  </>);
}
