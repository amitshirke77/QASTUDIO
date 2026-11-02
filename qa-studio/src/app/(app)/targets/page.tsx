import { db, schema as t } from '@/db';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { getUsers, nameOf } from '@/lib/data';
import { planState } from '@/lib/plan';
import { prevMonths, MON } from '@/lib/dates';
import { PageHead, Kpi } from '@/components/ui';
import { LineEditor, NewCustomerProducts, PlanSettingsForm, TargetRow, VolumeCell } from './Editors';
import { hierarchy, scopedCustomers, scopedLobs, scopedUserIds } from '@/lib/scope';

export default async function Targets() {
  const u = await requireUser('targets.view');
  const edit = can(u.role, 'targets.manage');
  const users = await getUsers(), ps = await planState();
  const months = prevMonths(ps.cur, 3); const ml = (m: string) => MON[+m.slice(5, 7) - 1] + ' ' + m.slice(2, 4);
  // only the clients in the user's scope: their LOBs, customers, plan lines and auditors
  const lobsIn = new Set(await scopedLobs(u)); const custRows = await scopedCustomers(u); const h = await hierarchy(u); const ids = await scopedUserIds(u);
  const customers = [...new Set(custRows.map((c) => c.name))]; const products = (await db.select().from(t.products)).filter((p) => lobsIn.has(p.lob));
  const lobRows = (await db.select().from(t.lobs)).filter((l) => lobsIn.has(l.name));
  ps.calc = ps.calc.filter((x) => lobsIn.has(x.l.lob));
  const totC = ps.calc.filter((x) => x.l.channel === 'Call').reduce((s, x) => s + x.c.target, 0), totE = ps.calc.filter((x) => x.l.channel === 'Email').reduce((s, x) => s + x.c.target, 0);
  const auditors = users.filter((x) => ['auditor', 'qalead'].includes(x.role) && x.active && (!ids || ids.has(x.id)) && (u.role !== 'auditor' || x.id === u.id));
  return (<>
    <PageHead title="Audit targets" sub={`Monthly targets per customer · LOB · product · channel from the previous three months' average volume (${months.map(ml).join(', ')}). New lines use a projected volume and a ramp-up multiplier. Targets are split across auditors by share.`} />
    <div className="kpis"><Kpi label="Call audits / month" value={totC} /><Kpi label="Email audits / month" value={totE} /><Kpi label="Sampling" value={`${ps.P.rates.Call}% calls · ${ps.P.rates.Email}% emails`} sub={`minimum ${ps.P.min} per line`} /><Kpi label="Unassigned" value={ps.dist.un.Call + ps.dist.un.Email} cls={ps.dist.un.Call + ps.dist.un.Email ? 's-warn' : ''} sub="lines with no eligible auditor" /></div>
    {edit && <PlanSettingsForm v={ps.P} />}
    <div className="card" style={{ padding: 0, marginTop: 14 }}><div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between' }}><h3>Volume plan</h3>{edit && <div style={{ display: 'flex', gap: 8 }}><NewCustomerProducts clients={h.clients.map((c) => ({ id: c.id, name: c.name }))} customers={custRows.map((c) => ({ name: c.name, clientId: c.clientId }))} lobs={lobRows.map((l) => ({ name: l.name, clientId: l.clientId }))} products={products.map((p) => [p.lob, p.name] as [string, string])} /><LineEditor customers={customers} products={products.map((p) => [p.lob, p.name])} /></div>}</div>
      <div className="tbl-wrap" style={{ border: 0, borderTop: '1px solid var(--line)', borderRadius: 0 }}><table className="tbl"><thead><tr><th>Customer</th><th>LOB · product</th><th>Channel</th>{months.map((m) => <th key={m} className="r">{ml(m)}</th>)}<th>Basis</th><th className="r">Avg</th><th className="r">Rate</th><th className="r">Target / month</th><th></th></tr></thead><tbody>
        {ps.calc.map(({ l, c }) => <tr key={l.id} style={{ opacity: l.active ? 1 : 0.5 }}><td>{l.customer}{l.isNew && <span className="chip acc" style={{ marginLeft: 6 }}>New{c.ramp ? ' · ramp-up' : ''}</span>}</td><td>{l.lob} · {l.product}</td><td>{l.channel}</td>
          {months.map((m, i) => <td key={m} className="r">{edit ? <VolumeCell line={l} month={m} v={c.hist[i]} /> : <span className="mono">{c.hist[i] ?? '—'}</span>}</td>)}
          <td className="small">{c.basis}</td><td className="r mono">{Math.round(c.avg)}</td><td className="r mono">{c.rate}%</td><td className="r mono"><b>{c.target}</b>{l.override != null && <span className="muted small"> (fixed)</span>}</td><td className="r">{edit && <LineEditor customers={customers} products={products.map((p) => [p.lob, p.name])} line={l} />}</td></tr>)}
      </tbody></table></div></div>
    <div className="card" style={{ padding: 0, marginTop: 14 }}><div style={{ padding: '14px 16px' }}><h3>Auditor targets</h3><p className="muted small" style={{ margin: '2px 0 0' }}>Share is relative capacity (1 = full share, 0 = no plan target). Overrides replace the plan figure.</p></div>
      <div className="tbl-wrap" style={{ border: 0, borderTop: '1px solid var(--line)', borderRadius: 0 }}><table className="tbl"><thead><tr><th>Auditor</th><th>Period</th><th className="r">Share</th><th>LOBs</th><th className="r">Calls</th><th className="r">Emails</th><th></th></tr></thead><tbody>
        {auditors.map((a) => { const cfg = ps.cfgs.find((c) => c.userId === a.id); const tg = ps.target(a.id); return <TargetRow key={a.id} lobs={[...lobsIn]} edit={edit} name={nameOf(users, a.id)} userId={a.id} cfg={cfg ? { period: cfg.period, share: cfg.share, lobs: cfg.lobs, overrideCalls: cfg.overrideCalls, overrideEmails: cfg.overrideEmails } : null} calls={tg?.calls ?? 0} emails={tg?.emails ?? 0} planCalls={tg?.planCalls ?? 0} planEmails={tg?.planEmails ?? 0} />; })}
      </tbody></table></div></div>
  </>);
}
