import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { getForms, getUsers, loadAudits, nameOf, paramIndex } from '@/lib/data';
import { learningAll } from '@/lib/learning';
import { agentQuizState } from '@/lib/quiz';
import { periodRows, sectionScores } from '@/lib/analytics';
import { addDays, fdate, today, weekEnding, MON } from '@/lib/dates';
import { avg } from '@/lib/util';
import QChart from '@/components/Charts';
import { Kpi, PageHead, Score, Status, Chip, pct, scls } from '@/components/ui';
import { Slicers } from './Slicers';

export default async function Workspace({ searchParams }: { searchParams: Record<string, string> }) {
  const u = await requireRole('agent');
  const users = await getUsers(); const me = users.find((x) => x.id === u.id)!;
  const sl = { from: searchParams.from || addDays(today(), -90), to: searchParams.to || today(), customer: searchParams.customer || '', channel: searchParams.channel || '' };
  const inF = (a: { auditDate: string; customer: string; channel: string }) => a.auditDate >= sl.from && a.auditDate <= sl.to && (!sl.customer || a.customer === sl.customer) && (!sl.channel || a.channel === sl.channel);
  const mine = await loadAudits(u, '2000-01-01', today());
  const others = await loadAudits({ ...u, role: 'qalead' }, sl.from, sl.to);
  const F = mine.filter(inF), T = others.filter((a) => inF(a) && users.find((x) => x.id === a.agentId)?.tlId === me.tlId), L = others.filter((a) => inF(a) && a.lob === me.lob);
  const pend = mine.filter((a) => a.status === 'Pending acknowledgement' || a.status === 'Dispute resolved'), ackd = mine.filter((a) => a.status === 'Acknowledged'), disp = mine.filter((a) => a.dispute);
  const { items, asg, subs } = await learningAll();
  const myAsg = asg.filter((a) => a.agentId === u.id && items.find((i) => i.id === a.itemId)?.status === 'Published');
  const lp = myAsg.filter((a) => !a.acceptedAt).map((a) => items.find((i) => i.id === a.itemId)!);
  const qstate = myAsg.map((a) => { const it = items.find((i) => i.id === a.itemId)!; return { it, st: agentQuizState(it.quiz, !!a.acceptedAt, subs.filter((s) => s.itemId === it.id && s.agentId === u.id).sort((x, y) => +x.at - +y.at)) }; }).filter((x) => x.st);
  const qTodo = qstate.filter((x) => x.st!.state === 'todo' || x.st!.state === 'retry'), qGr = qstate.filter((x) => x.st!.state === 'grading');
  // trend
  const wk = [...new Set([...F, ...T].map((a) => weekEnding(a.auditDate)))].sort();
  const at = (A: typeof F, k: string, f: (a: (typeof F)[number]) => number) => { const v = A.filter((a) => weekEnding(a.auditDate) === k); return v.length ? avg(v.map(f)) : null; };
  // compare + rank
  const mates = users.filter((x) => x.role === 'agent' && x.tlId === me.tlId);
  const rank = mates.map((m) => { const v = T.filter((a) => a.agentId === m.id); return [m.id, v.length ? avg(v.map((a) => a.actual))! : null] as const; }).filter((x) => x[1] != null).sort((a, b) => b[1]! - a[1]!);
  const myRank = rank.findIndex((x) => x[0] === u.id) + 1;
  const m3 = (A: typeof F) => [avg(A.map((a) => a.overall)), avg(A.map((a) => a.actual)), A.length ? (A.filter((a) => !a.fatal).length / A.length) * 100 : null];
  // where I lose marks
  const pidx = await paramIndex(); const myN = new Map<string, number>(), myR = new Map<string, number>(), tN = new Map<string, number>(), tR = new Map<string, number>();
  F.forEach((a) => Object.entries(a.answers).forEach(([p, v]) => { myR.set(p, (myR.get(p) || 0) + 1); if (v === 'N') myN.set(p, (myN.get(p) || 0) + 1); }));
  T.forEach((a) => Object.entries(a.answers).forEach(([p, v]) => { tR.set(p, (tR.get(p) || 0) + 1); if (v === 'N') tN.set(p, (tN.get(p) || 0) + 1); }));
  const lose = [...myN.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const lastAoi = (p: string) => F.slice().sort((a, b) => (a.auditDate < b.auditDate ? 1 : -1)).flatMap((a) => a.aois).find((x) => x.paramId === p)?.text;
  const forms = (await getForms()).filter((f) => f.status === 'Active'); const callForm = forms.find((f) => f.channel === (sl.channel || 'Call'));
  const secMe = callForm ? sectionScores(F.filter((a) => a.formId === callForm.id), callForm) : [], secTeam = callForm ? sectionScores(T.filter((a) => a.formId === callForm.id), callForm) : [];
  const pr = periodRows(mine); const customers = [...new Set(mine.map((a) => a.customer))].sort();
  return (<>
    <PageHead title={`Hello, ${me.name.split(' ')[0]}`} sub={<><Chip tone="acc">{me.lob}</Chip> Team leader {nameOf(users, me.tlId)}. Your audits, trainings and how you are trending.</>} />
    <div className="kpis">
      <Kpi label="Evaluations completed" value={mine.length} sub={`${mine.filter((a) => a.auditDate.slice(0, 7) === today().slice(0, 7)).length} this month`} />
      <Kpi label="Awaiting your acknowledgement" value={pend.length} cls={pend.length ? 's-warn' : ''} />
      <Kpi label="Feedback acknowledged" value={ackd.length} cls="s-good" />
      <Kpi label="Disputes" value={disp.length} />
      <Kpi label="Trainings & briefings pending" value={lp.length} cls={lp.length ? 's-warn' : ''} sub={lp.filter((i) => i.due && i.due < today()).length ? lp.filter((i) => i.due && i.due < today()).length + ' overdue' : ''} href="/me/learning" />
      <Kpi label="JIT quizzes pending" value={qTodo.length} cls={qTodo.length ? 's-warn' : ''} sub={qGr.length ? qGr.length + ' waiting for grading' : ''} href="/me/learning" />
    </div>
    {(pend.length > 0 || lp.length > 0 || qTodo.length > 0) && <div className="card" style={{ marginBottom: 14 }}><h3 style={{ marginBottom: 6 }}>To do</h3>
      {pend.slice(0, 5).map((a) => <div key={a.id} className="ag-todo"><Chip tone="warn">Acknowledge</Chip><span className="ag-todo-t">{a.channel} audit {a.caseId} · {fdate(a.auditDate)} · <Score v={a.actual} fatal={a.fatal} /></span><Link className="btn sm primary" href={`/audits/${a.id}`}>Review</Link></div>)}
      {lp.slice(0, 5).map((i) => <div key={i.id} className="ag-todo"><Chip tone={i.type === 'JIT' ? 'acc' : 'warn'}>{i.type === 'JIT' ? 'JIT training' : 'Briefing note'}</Chip><span className="ag-todo-t">{i.title}{i.due && <> · <span className={i.due < today() ? 's-bad' : ''}>accept by {fdate(i.due)}</span></>}</span><Link className="btn sm primary" href={`/me/learning/${i.id}`}>Read and accept</Link></div>)}
      {qTodo.slice(0, 5).map(({ it, st }) => <div key={it.id} className="ag-todo"><Chip tone="acc">Quiz</Chip><span className="ag-todo-t">{it.title} · {st!.label}</span><Link className="btn sm primary" href={`/me/learning/${it.id}?quiz=1`}>{st!.state === 'retry' ? 'Try again' : 'Start quiz'}</Link></div>)}
    </div>}
    <div className="kpis">{pr.map((p) => <div key={p.label} className="kpi"><span className="l">{p.label} · {p.n} audits</span><span className={'v ' + scls(p.actual)}>{pct(p.actual)}</span><span className="muted small mono">Overall {pct(p.overall)}</span></div>)}</div>
    <div className="card" style={{ marginBottom: 14 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}><h3>Feedback analysis</h3><Slicers v={sl} customers={customers} /><span className="muted small">{F.length} of your audits · team {T.length}</span></div></div>
    <div className="grid g2">
      <div className="card chart-card" style={{ gridColumn: '1/-1' }}><div className="hd"><h3>My improvement trend</h3><span className="muted small">Weekly Actual and Overall against your team&apos;s average</span></div><QChart labels={wk.map((k) => 'WE ' + fdate(k).slice(0, -5))} sets={[{ label: 'My Actual', data: wk.map((k) => at(F, k, (a) => a.actual)), color: 0, fill: true }, { label: 'My Overall', data: wk.map((k) => at(F, k, (a) => a.overall)), color: 1 }, { label: 'Team Actual', data: wk.map((k) => at(T, k, (a) => a.actual)), color: 2, dashed: true }]} /></div>
      <div className="card chart-card"><div className="hd"><h3>How I compare</h3><span className="muted small">{myRank ? `You rank ${myRank} of ${rank.length} in ${nameOf(users, me.tlId)}'s team on Actual quality` : 'No audits in this period'}</span></div><QChart type="bar" labels={['Overall', 'Actual quality', 'Fatal-free']} sets={[{ label: 'Me', data: m3(F), color: 0 }, { label: 'My team', data: m3(T), color: 1 }, { label: `${me.lob} agents`, data: m3(L), color: 2 }]} /></div>
      <div className="card chart-card"><div className="hd"><h3>Section scores: me vs team</h3><span className="muted small">Marks earned as % of each section ({callForm?.channel} form)</span></div><QChart type="bar" horizontal height={300} labels={secMe.map((s) => s.name.slice(0, 26))} sets={[{ label: 'Me', data: secMe.map((s) => s.pct), color: 0 }, { label: 'My team', data: secTeam.map((s) => s.pct), color: 1 }]} /></div>
      <div className="card" style={{ padding: 0 }}><div style={{ padding: '14px 16px' }}><h3>Where I lose marks</h3><p className="muted small" style={{ margin: '2px 0 0' }}>Parameters rated No in your audits, against the team&apos;s No rate</p></div><div className="tbl-wrap" style={{ border: 0, borderTop: '1px solid var(--line)', borderRadius: 0 }}><table className="tbl"><thead><tr><th>Parameter</th><th className="r">Times No</th><th className="r">My No rate</th><th className="r">Team No rate</th></tr></thead><tbody>
        {lose.length ? lose.map(([p, n]) => <tr key={p}><td>{pidx[p]?.name}{lastAoi(p) && <div className="muted small">Latest feedback: {lastAoi(p)!.slice(0, 110)}</div>}</td><td className="r mono">{n}</td><td className="r s-bad mono">{pct((n / (myR.get(p) || 1)) * 100)}</td><td className="r mono">{pct(((tN.get(p) || 0) / (tR.get(p) || 1)) * 100)}</td></tr>) : <tr><td colSpan={4} className="muted">No marks lost in this period. Well done.</td></tr>}
      </tbody></table></div><div style={{ padding: '8px 16px' }}><Link className="rel-link small" href="/legend">See how each parameter is rated</Link></div></div>
      <div className="card stack"><h3>Latest feedback from audits</h3>{F.flatMap((a) => a.aois.map((x) => ({ x, a }))).slice(0, 6).map(({ x, a }) => <div key={x.id} className="ag-fb"><span className="tag-param">{pidx[x.paramId || '']?.name || 'General'}</span><p style={{ margin: '4px 0' }}>{x.text}</p><Link className="rel-link small" href={`/audits/${a.id}`}>{a.caseId} · {fdate(a.auditDate)}</Link></div>)}</div>
    </div>
    <div className="card" style={{ padding: 0, marginTop: 14 }}><div style={{ padding: '14px 16px' }}><h3>All my audits</h3></div><div className="tbl-wrap" style={{ border: 0, borderTop: '1px solid var(--line)', borderRadius: 0 }}><table className="tbl"><thead><tr><th>Audit date</th><th>Case</th><th>Customer</th><th>Type</th><th className="r">Overall</th><th className="r">Actual</th><th>Status</th><th></th></tr></thead><tbody>
      {mine.slice(0, 60).map((a) => <tr key={a.id}><td>{fdate(a.auditDate)}</td><td>{a.caseId}</td><td>{a.customer}</td><td>{a.channel}</td><td className="r"><Score v={a.overall} /></td><td className="r"><Score v={a.actual} fatal={a.fatal} /></td><td><Status s={a.status} /></td><td className="r"><Link className={'btn sm ' + (a.status === 'Pending acknowledgement' ? 'primary' : '')} href={`/audits/${a.id}`}>{a.status === 'Pending acknowledgement' ? 'Review' : 'Open'}</Link></td></tr>)}
    </tbody></table></div></div>
    <p className="muted small" style={{ marginTop: 8 }}>{MON[+today().slice(5, 7) - 1]} {today().slice(0, 4)}</p>
  </>);
}
