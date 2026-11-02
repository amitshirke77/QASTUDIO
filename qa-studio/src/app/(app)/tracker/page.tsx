import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getSetting, getUsers, loadAudits, nameOf } from '@/lib/data';
import { feedbackItems, fbAge, FB_LABEL, DEFAULT_FB, type FbTargets } from '@/lib/feedback';
import { addDays, fdate, today } from '@/lib/dates';
import { ActionButton, Seg } from '@/components/client';
import { sendReminder } from '@/app/actions/audits';
import { Kpi, PageHead, Chip, Empty } from '@/components/ui';
export default async function Tracker({ searchParams }: { searchParams: { type?: string; mine?: string } }) {
  const u = await requireUser('tracker');
  const users = await getUsers(), cfg = await getSetting<FbTargets>('feedbackTargets', DEFAULT_FB);
  let A = await loadAudits(u, addDays(today(), -120), today());
  if (u.role === 'auditor' && searchParams.mine !== 'all') A = A.filter((a) => a.auditorId === u.id);
  const all = feedbackItems(A.map((a) => ({ ...a, disputeAt: a.dispute?.raisedAt, resolvedAt: a.dispute?.resolvedAt })), cfg);
  const items = all.filter((x) => !searchParams.type || x.type === searchParams.type || (searchParams.type === 'over' && x.over));
  return (<>
    <PageHead title="Feedback tracker" sub={`Feedback to deliver within ${cfg.deliverH}h of the audit, agent acknowledgement within ${cfg.ackH}h of delivery, disputes resolved within ${cfg.disputeH}h. Log a session on the audit page.`} />
    <div className="kpis"><Kpi label="Not delivered" value={all.filter((x) => x.type === 'undelivered').length} cls="s-warn" /><Kpi label="Awaiting agent" value={all.filter((x) => x.type === 'awaitAck').length} /><Kpi label="Disputes open" value={all.filter((x) => x.type === 'dispute').length} cls={all.some((x) => x.type === 'dispute') ? 's-bad' : ''} /><Kpi label="Past target time" value={all.filter((x) => x.over).length} cls={all.some((x) => x.over) ? 's-bad' : ''} /></div>
    <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}><Seg k="type" def="" opts={[['', 'All'], ['undelivered', 'Not delivered'], ['awaitAck', 'Awaiting agent'], ['dispute', 'Disputes'], ['over', 'Past target']]} />{u.role === 'auditor' && <Seg k="mine" def="" opts={[['', 'My audits'], ['all', 'All auditors']]} />}</div>
    {items.length ? <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Status</th><th>Case</th><th>Agent</th><th>TL</th><th>QA</th><th>Audit date</th><th className="r">Age</th><th>Next step</th><th></th></tr></thead><tbody>
      {items.slice(0, 300).map((x) => <tr key={x.a.id}><td><Chip tone={FB_LABEL[x.type][1]}>{FB_LABEL[x.type][0]}</Chip>{x.over && <Chip tone="bad">Past target</Chip>}</td><td><Link className="rel-link" href={`/audits/${x.a.id}`}>{x.a.caseId}</Link></td><td>{nameOf(users, x.a.agentId)}</td><td className="small">{nameOf(users, x.a.tlId)}</td><td className="small">{nameOf(users, x.a.auditorId)}</td><td>{fdate(x.a.auditDate)}</td><td className={'r mono ' + (x.over ? 's-bad' : '')}>{fbAge(x.ageH)} / {x.dueH}h</td><td className="small">{x.next}</td><td className="r"><ActionButton className="sm" label="Remind" success="Reminder sent" action={sendReminder} args={[x.a.id]} /></td></tr>)}
    </tbody></table></div> : <Empty>Nothing open. Every feedback is delivered and acknowledged.</Empty>}
  </>);
}
