import { visibleUsers } from '@/lib/scope';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getUsers } from '@/lib/data';
import { adherenceFor } from '@/lib/plan';
import { fdate } from '@/lib/dates';
import type { Row } from '@/lib/adherence';
import { Seg } from '@/components/client';
import QChart from '@/components/Charts';
import { Kpi, PageHead, Chip, Empty } from '@/components/ui';
import { AuditorPicker } from './Picker';

const n1 = (v: number) => (Math.round(v * 10) / 10).toString();
const tone = (r: { gap: number; plan: number; done: number }) => (r.plan > 0 && r.done >= r.plan ? 'good' : r.gap >= 1 ? 'bad' : r.gap > 0.25 ? 'warn' : 'good');
function MixTable({ title, rows, note }: { title: string; rows: Row[]; note: string }) {
  return (<div className="card" style={{ padding: 0 }}><div style={{ padding: '14px 16px' }}><h3>{title}</h3><p className="muted small" style={{ margin: '2px 0 0' }}>{note}</p></div>
    <div className="tbl-wrap" style={{ border: 0, borderTop: '1px solid var(--line)', borderRadius: 0 }}><table className="tbl"><thead><tr><th></th><th className="r">Plan</th><th className="r">Due by today</th><th className="r">Done</th><th style={{ minWidth: 120 }}>Progress</th><th className="r">Plan mix</th><th className="r">Your mix</th><th></th></tr></thead><tbody>
      {rows.map((r) => <tr key={r.key}><td>{r.label}</td><td className="r mono">{n1(r.plan)}</td><td className="r mono">{n1(r.expected)}</td><td className="r mono"><b>{r.done}</b></td>
        <td><div className="bar"><i style={{ width: Math.min(100, r.plan ? (r.done / r.plan) * 100 : 0) + '%' }} /></div></td>
        <td className="r mono">{r.planShare.toFixed(0)}%</td><td className={'r mono ' + (Math.abs(r.doneShare - r.planShare) > 10 ? 's-warn' : '')}>{r.doneShare.toFixed(0)}%</td>
        <td><Chip tone={tone(r)}>{r.plan > 0 && r.done >= r.plan ? 'Met' : r.gap >= 0.5 ? `${n1(r.gap)} behind` : r.plan === 0 ? 'Not in plan' : 'On pace'}</Chip></td></tr>)}
    </tbody></table></div></div>);
}

export default async function Plan({ searchParams }: { searchParams: { auditor?: string; period?: string } }) {
  const u = await requireUser('targets.view');
  const users = await visibleUsers(u, await getUsers());
  const lead = ['admin', 'qalead', 'manager'].includes(u.role);
  const auditors = users.filter((x) => ['auditor', 'qalead'].includes(x.role) && x.active);
  const who = lead ? searchParams.auditor || auditors.find((a) => a.role === 'auditor')?.id || u.id : u.id;
  const period = searchParams.period === 'Monthly' || searchParams.period === 'Weekly' ? searchParams.period : undefined;
  const r = await adherenceFor(who, period);
  const name = users.find((x) => x.id === who)?.name || '';
  const head = <PageHead title={lead ? 'Plan adherence' : 'My plan'} sub={`How ${lead ? name + "'s" : 'your'} audits line up with the volume plan: in total, by channel, customer and product, and agent by agent. Audit the suggestions first to bring the mix back in line.`}
    actions={<>{lead && <AuditorPicker auditors={auditors.map((a) => [a.id, a.name])} value={who} />}<Seg k="period" def="" opts={[['', 'Plan period'], ['Weekly', 'This week'], ['Monthly', 'This month']]} /></>} />;
  if (!r) return <>{head}<Empty>No audit target is set for {lead ? name : 'you'} yet. A QA Lead sets it under Audit targets.</Empty></>;
  const calls = r.byChannel.find((x) => x.key === 'Call'), emails = r.byChannel.find((x) => x.key === 'Email');
  return (<>
    {head}
    <div className="kpis">
      <Kpi label={`${r.period === 'Monthly' ? 'This month' : 'This week'} · ${fdate(r.from).slice(0, -5)} to ${fdate(r.to).slice(0, -5)}`} value={`${r.doneTotal} / ${Math.round(r.planTotal)}`} cls={r.status === 'Behind pace' ? 's-bad' : 's-good'} sub={`${r.workDaysGone} of ${r.workDays} working days gone`} />
      <Kpi label="Due by today" value={n1(r.expectedTotal)} sub={r.status} cls={r.status === 'Behind pace' ? 's-warn' : ''} />
      <Kpi label="Calls" value={`${calls?.done ?? 0} / ${n1(calls?.plan ?? 0)}`} sub={calls && calls.gap >= 0.5 ? `${n1(calls.gap)} behind pace` : 'on pace'} />
      <Kpi label="Emails" value={`${emails?.done ?? 0} / ${n1(emails?.plan ?? 0)}`} sub={emails && emails.gap >= 0.5 ? `${n1(emails.gap)} behind pace` : 'on pace'} />
      <Kpi label="Mix match" value={r.mixMatch == null ? '—' : r.mixMatch.toFixed(0) + '%'} cls={r.mixMatch == null ? '' : r.mixMatch >= 85 ? 's-good' : r.mixMatch >= 70 ? 's-warn' : 's-bad'} sub="how closely your customer · product · channel mix follows the plan" />
    </div>
    <div className="card stack" style={{ marginBottom: 14 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}><div><h3>Audit next</h3><p className="muted small" style={{ margin: '2px 0 0' }}>The plan lines furthest behind, each paired with the agent in that LOB who has the most audits still to do on that channel.</p></div></div>
      {r.suggestions.length ? r.suggestions.map((s, i) => <div key={i} className="ag-todo"><Chip tone="acc">{i + 1}</Chip><span className="ag-todo-t"><b>{s.agentName}</b> · {s.customer} · {s.product} · {s.channel}<br /><span className="muted small">{s.reason}</span></span>{!lead || who === u.id ? <Link className="btn sm primary" href={`/audits/new?${new URLSearchParams({ agent: s.agentId, customer: s.customer, product: s.product, channel: s.channel })}`}>Start audit</Link> : null}</div>)
        : <p className="muted" style={{ margin: 0 }}>Every plan line is on pace or met. Keep auditing across the mix.</p>}</div>
    <div className="grid g2" style={{ marginBottom: 14 }}>
      <div className="card chart-card"><div className="hd"><h3>By customer</h3><span className="muted small">Plan for the period against audits done</span></div><QChart type="bar" pct={false} labels={r.byClient.map((x) => x.label)} sets={[{ label: 'Plan', data: r.byClient.map((x) => +x.plan.toFixed(1)), color: 2 }, { label: 'Due by today', data: r.byClient.map((x) => +x.expected.toFixed(1)), color: 1 }, { label: 'Done', data: r.byClient.map((x) => x.done), color: 0 }]} /></div>
      <div className="card chart-card"><div className="hd"><h3>Agent-wise</h3><span className="muted small">Calls and emails done against each agent&apos;s share of the plan</span></div><QChart type="bar" pct={false} horizontal height={Math.max(220, r.agentRows.length * 28)} labels={r.agentRows.map((x) => x.name)} sets={[{ label: 'Plan', data: r.agentRows.map((x) => +(x.planCalls + x.planEmails).toFixed(1)), color: 2 }, { label: 'Done', data: r.agentRows.map((x) => x.done), color: 0 }]} /></div>
    </div>
    <div className="stack">
      <MixTable title="By channel" rows={r.byChannel} note="Calls and emails against the plan" />
      <MixTable title="By customer" rows={r.byClient} note="Plan mix = each customer's share of your plan; your mix = its share of the audits you have done" />
      <MixTable title="By LOB and product" rows={r.byProduct} note="Product mix within your LOBs" />
      <MixTable title="By plan line" rows={r.byLine} note="Customer · LOB · product · channel, as set in the volume plan" />
      <div className="card" style={{ padding: 0 }}><div style={{ padding: '14px 16px' }}><h3>Agent-wise adherence</h3><p className="muted small" style={{ margin: '2px 0 0' }}>Each plan line is split equally across the active agents in its LOB.</p></div>
        <div className="tbl-wrap" style={{ border: 0, borderTop: '1px solid var(--line)', borderRadius: 0 }}><table className="tbl"><thead><tr><th>Agent</th><th>LOB</th><th className="r">Calls done / plan</th><th className="r">Emails done / plan</th><th className="r">Due by today</th><th>Status</th><th></th></tr></thead><tbody>
          {r.agentRows.map((a) => <tr key={a.id}><td>{a.name}</td><td>{a.lob}</td><td className="r mono">{a.doneCalls} / {n1(a.planCalls)}</td><td className="r mono">{a.doneEmails} / {n1(a.planEmails)}</td><td className="r mono">{n1(a.expected)}</td><td><Chip tone={a.status === 'Behind' || a.status === 'Not started' ? 'warn' : a.status === 'Not in plan' ? '' : 'good'}>{a.status}</Chip></td>
            <td className="r">{(!lead || who === u.id) && a.done < a.planCalls + a.planEmails && <Link className="btn sm" href={`/audits/new?${new URLSearchParams({ agent: a.id, channel: a.planCalls - a.doneCalls >= a.planEmails - a.doneEmails ? 'Call' : 'Email' })}`}>Audit</Link>}</td></tr>)}
        </tbody></table></div></div>
    </div>
  </>);
}
