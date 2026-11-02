import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { applyFilters, getForms, getSetting, getUsers, loadAudits, nameOf, paramIndex, parseFilters } from '@/lib/data';
import { filterOptions } from '@/lib/filters';
import { byKey, kpis, paramNRates, series, sectionScores } from '@/lib/analytics';
import { feedbackItems, DEFAULT_FB, type FbTargets } from '@/lib/feedback';
import { addDays, today } from '@/lib/dates';
import { FilterBar } from '@/components/client';
import { hierarchy } from '@/lib/scope';
import { CompanyLogo } from '@/components/CompanyLogo';
import QChart from '@/components/Charts';
import { Kpi, PageHead, Score, Status, pct, scls } from '@/components/ui';
import { LearningCard } from './LearningCard';

export default async function Dashboard({ searchParams }: { searchParams: Record<string, string> }) {
  const u = await requireUser('dashboard');
  const f = parseFilters(searchParams);
  const users = await getUsers();
  const wide = await loadAudits(u, addDays(f.from, -120), f.to, { by: f.by });
  const A = applyFilters(wide, f), all = applyFilters(wide, { ...f, agent: '' });
  const k = kpis(A), s = series(A, 'week'), sAll = series(all, 'week');
  const pidx = await paramIndex(), forms = (await getForms()).filter((x) => x.status === 'Active');
  const opts = await filterOptions(u, users);
  const agentName = f.agent ? nameOf(users, f.agent) : '';
  const byClient = byKey(A, (a) => a.customer).sort((a, b) => b.n - a.n);
  const byAgent = byKey(A, (a) => a.agentId).sort((a, b) => b.actual - a.actual);
  const topN = paramNRates(A).filter((x) => x.no).slice(0, 10);
  const fb = feedbackItems(wide.filter((a) => applyFilters([a], { ...f, from: '0000-01-01', to: '9999-12-31', we: '' }).length).map((a) => ({ ...a, disputeAt: a.dispute?.raisedAt, resolvedAt: a.dispute?.resolvedAt })), await getSetting<FbTargets>('feedbackTargets', DEFAULT_FB));
  const hh = u.role === 'client' ? await hierarchy(u) : null; const myClient = hh ? hh.clients[0]?.name || u.name : ''; const myCo = hh?.clients[0]?.companyId;
  const title = u.role === 'client' ? `${myClient} quality dashboard` : u.role === 'tl' ? 'Team quality dashboard' : 'Quality dashboard';
  // agent vs all-agents comparison per week when one agent is picked
  const wk = sAll.keys, mine = new Map(s.keys.map((x, i) => [x, s.actual[i]]));
  return (
    <>
      <PageHead title={title} logo={myCo ? <CompanyLogo id={myCo} h={22} /> : undefined} sub={`${f.from} to ${f.to} · ${f.by === 'call' ? 'by call / email date' : 'by audit date'}${agentName ? ' · ' + agentName : ''}`} actions={u.role !== 'client' && u.role !== 'manager' ? <Link className="btn primary" href="/audits/new">New audit</Link> : undefined} />
      <FilterBar {...opts} from={f.from} to={f.to} />
      <div className="kpis">
        <Kpi label="Audits" value={k.n} sub={`${k.calls} calls · ${k.emails} emails`} href={`/audits?${new URLSearchParams(searchParams)}`} />
        <Kpi label="Overall score" value={pct(k.overall)} cls={scls(k.overall)} />
        <Kpi label="Actual quality" value={pct(k.actual)} cls={scls(k.actual)} sub="0 when a fatal is marked No" />
        <Kpi label="Fatal errors" value={k.fatal} cls={k.fatal ? 's-bad' : ''} sub={pct(k.fatalRate) + ' of audits'} href={`/reports?r=fatal-register&${new URLSearchParams(searchParams)}`} />
        <Kpi label="Acknowledged" value={pct(k.ackRate)} sub={`${k.pending} pending`} />
        <Kpi label="Open disputes" value={k.disputed} cls={k.disputed ? 's-warn' : ''} href={u.role === 'client' ? undefined : '/disputes'} />
      </div>
      <div className="grid g2">
        <div className="card chart-card" style={{ gridColumn: '1/-1' }}><div className="hd"><h3>{agentName ? `${agentName} vs all agents` : 'Weekly trend'}</h3><span className="muted small">Actual and Overall by week ending; bars show audits</span></div>
          {agentName
            ? <QChart labels={sAll.labels} sets={[{ label: `${agentName} · Actual`, data: wk.map((x) => mine.get(x) ?? null), color: 0 }, { label: 'All agents · Actual', data: sAll.actual, color: 2, dashed: true }, { label: `${agentName} audits`, data: wk.map((x) => s.n[s.keys.indexOf(x)] ?? 0), type: 'bar', axis: 'y1', color: 1 }]} />
            : <QChart labels={s.labels} sets={[{ label: 'Actual', data: s.actual, color: 0, fill: true }, { label: 'Overall', data: s.overall, color: 1, dashed: true }, { label: 'Audits', data: s.n, type: 'bar', axis: 'y1', color: 2 }]} />}
        </div>
        <div className="card chart-card"><div className="hd"><h3>By customer</h3><span className="muted small">Actual quality</span></div><QChart type="bar" labels={byClient.map((x) => x.key)} sets={[{ label: 'Actual', data: byClient.map((x) => x.actual), color: 0 }, { label: 'Overall', data: byClient.map((x) => x.overall), color: 2 }]} /></div>
        <div className="card chart-card"><div className="hd"><h3>Most-missed parameters</h3><span className="muted small">“No” rate, % of ratings</span></div><QChart type="bar" horizontal pct={false} height={300} labels={topN.map((x) => (pidx[x.paramId]?.name || x.paramId).slice(0, 34))} sets={[{ label: 'No rate %', data: topN.map((x) => +x.rate.toFixed(1)), color: 5 }]} /></div>
        {forms.map((fm) => { const sc = sectionScores(A.filter((a) => a.formId === fm.id), fm); return <div key={fm.id} className="card chart-card"><div className="hd"><h3>{fm.channel} sections</h3><span className="muted small">Marks earned, % of each section</span></div><QChart type="bar" horizontal height={280} labels={sc.map((x) => x.name.slice(0, 30))} sets={[{ label: 'Score', data: sc.map((x) => x.pct), color: fm.channel === 'Call' ? 0 : 3 }]} /></div>; })}
      </div>
      {!f.agent && u.role !== 'agent' && <div className="card" style={{ padding: 0, marginTop: 14 }}><div style={{ padding: '14px 16px' }}><h3>Agents</h3></div><div className="tbl-wrap" style={{ border: 0, borderTop: '1px solid var(--line)', borderRadius: 0 }}><table className="tbl"><thead><tr><th>Agent</th><th>LOB</th><th>TL</th><th className="r">Audits</th><th className="r">Overall</th><th className="r">Actual</th><th className="r">Fatals</th></tr></thead><tbody>
        {byAgent.map((x) => { const ag = users.find((y) => y.id === x.key); return <tr key={x.key}><td><Link className="rel-link" href={`/dashboard?${new URLSearchParams({ ...searchParams, agent: x.key })}`}>{ag?.name}</Link></td><td>{ag?.lob}</td><td>{nameOf(users, ag?.tlId)}</td><td className="r mono">{x.n}</td><td className="r"><Score v={x.overall} /></td><td className="r"><Score v={x.actual} /></td><td className="r mono">{x.fatal}</td></tr>; })}
      </tbody></table></div></div>}
      {u.role !== 'client' && <div className="card" style={{ marginTop: 14 }}><div className="fb-sum-hd"><div><h3>Feedback tracker</h3><p className="muted small" style={{ margin: '2px 0 0' }}>Feedback still to close for audits in this view.</p></div><Link className="btn sm" href="/tracker">Open tracker</Link></div>
        <div className="kpis" style={{ margin: 0 }}><Kpi label="Not delivered" value={fb.filter((x) => x.type === 'undelivered').length} /><Kpi label="Awaiting agent" value={fb.filter((x) => x.type === 'awaitAck').length} /><Kpi label="Disputes open" value={fb.filter((x) => x.type === 'dispute').length} /><Kpi label="Past target time" value={fb.filter((x) => x.over).length} cls={fb.some((x) => x.over) ? 's-bad' : ''} /></div></div>}
      {u.role !== 'client' && <LearningCard u={u} f={f} />}
      <div className="card" style={{ padding: 0, marginTop: 14 }}><div style={{ padding: '14px 16px' }}><h3>Latest audits</h3></div><div className="tbl-wrap" style={{ border: 0, borderTop: '1px solid var(--line)', borderRadius: 0 }}><table className="tbl"><thead><tr><th>Date</th><th>Case</th><th>Agent</th><th>Customer</th><th>Type</th><th className="r">Actual</th><th>Status</th></tr></thead><tbody>
        {A.slice(0, 8).map((a) => <tr key={a.id}><td>{a.auditDate}</td><td><Link className="rel-link" href={`/audits/${a.id}`}>{a.caseId}</Link></td><td>{nameOf(users, a.agentId)}</td><td>{a.customer}</td><td>{a.channel}</td><td className="r"><Score v={a.actual} fatal={a.fatal} /></td><td><Status s={a.status} /></td></tr>)}
      </tbody></table></div></div>
      <p className="muted small" style={{ marginTop: 10 }}>Data as of {today()}.</p>
    </>
  );
}
