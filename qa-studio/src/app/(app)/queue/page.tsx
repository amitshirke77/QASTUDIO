import Link from 'next/link';
import { and, eq } from 'drizzle-orm';
import { db, schema as t } from '@/db';
import { requireUser } from '@/lib/auth';
import { getUsers, loadAudits, nameOf } from '@/lib/data';
import { planState, adherenceFor } from '@/lib/plan';
import { addDays, fdate, today, weekEnding } from '@/lib/dates';
import { Kpi, PageHead, Empty } from '@/components/ui';
export default async function Queue() {
  const u = await requireUser('audit.create');
  const users = await getUsers();
  const q = await db.select().from(t.allocations).where(and(eq(t.allocations.auditorId, u.id), eq(t.allocations.status, 'Pending')));
  const ps = await planState(); const tg = ps.target(u.id);
  const from = tg?.period === 'Monthly' ? today().slice(0, 8) + '01' : addDays(weekEnding(today()), -6);
  const mine = (await loadAudits(u, from, today())).filter((a) => a.auditorId === u.id);
  const c = mine.filter((a) => a.channel === 'Call').length, e = mine.length - c;
  const adh = await adherenceFor(u.id);
  return (<>
    <PageHead title="My queue" sub="Audits allocated to you, and your target for the period from the volume plan." actions={<Link className="btn primary" href="/audits/new">New ad-hoc audit</Link>} />
    {tg && <div className="kpis"><Kpi label={`${tg.period} call target`} value={`${c}/${tg.calls}`} cls={c >= tg.calls ? 's-good' : 's-warn'} sub={`plan ${tg.planCalls}`} /><Kpi label={`${tg.period} email target`} value={`${e}/${tg.emails}`} cls={e >= tg.emails ? 's-good' : 's-warn'} sub={`plan ${tg.planEmails}`} /><Kpi label="Pending allocations" value={q.length} cls={q.length ? 's-warn' : ''} /><Kpi label="Plan mix match" value={adh?.mixMatch == null ? '—' : adh.mixMatch.toFixed(0) + '%'} sub={adh ? adh.status : ''} href="/plan" /><Kpi label="Overdue" value={q.filter((x) => x.dueDate < today()).length} cls={q.some((x) => x.dueDate < today()) ? 's-bad' : ''} /></div>}
    {adh && adh.suggestions[0] && <div className="card" style={{ marginBottom: 14, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}><span style={{ flex: 1 }}><b>Next in your plan:</b> {adh.suggestions[0].agentName} · {adh.suggestions[0].customer} · {adh.suggestions[0].product} · {adh.suggestions[0].channel}</span><Link className="btn sm" href="/plan">My plan</Link><Link className="btn sm primary" href={`/audits/new?${new URLSearchParams({ agent: adh.suggestions[0].agentId, customer: adh.suggestions[0].customer, product: adh.suggestions[0].product, channel: adh.suggestions[0].channel })}`}>Start audit</Link></div>}
    {q.length ? <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Agent</th><th>LOB</th><th>Type</th><th>Due</th><th>Note</th><th></th></tr></thead><tbody>{q.sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1)).map((x) => <tr key={x.id}><td>{nameOf(users, x.agentId)}</td><td>{users.find((y) => y.id === x.agentId)?.lob}</td><td>{x.channel}</td><td className={x.dueDate < today() ? 's-bad' : ''}>{fdate(x.dueDate)}</td><td className="small">{x.note}</td><td className="r"><Link className="btn sm primary" href={`/audits/new?alloc=${x.id}`}>Start audit</Link></td></tr>)}</tbody></table></div> : <Empty>Your queue is empty.</Empty>}
  </>);
}
