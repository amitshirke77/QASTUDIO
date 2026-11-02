import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getUsers, loadAudits, nameOf, paramIndex } from '@/lib/data';
import { addDays, today, fdt } from '@/lib/dates';
import { canResolveDispute } from '@/lib/rbac';
import { PageHead, Score, Status, Empty } from '@/components/ui';
export default async function Disputes() {
  const u = await requireUser('dispute.resolve');
  const users = await getUsers(), pidx = await paramIndex();
  const A = (await loadAudits(u, addDays(today(), -365), today())).filter((a) => a.dispute && (a.status === 'Disputed' || a.status === 'Dispute resolved'));
  const open = A.filter((a) => a.status === 'Disputed'), done = A.filter((a) => a.status !== 'Disputed').slice(0, 30);
  const row = (a: (typeof A)[number]) => <tr key={a.id}><td><Link className="rel-link" href={`/audits/${a.id}`}>{a.caseId}</Link></td><td>{nameOf(users, a.agentId)}</td><td className="small">{nameOf(users, a.auditorId)}</td><td className="small">{a.dispute!.paramIds.map((p) => pidx[p]?.name).join('; ')}</td><td className="small">{fdt(a.dispute!.raisedAt)}</td><td className="r"><Score v={a.actual} fatal={a.fatal} /></td><td>{a.dispute!.outcome ? a.dispute!.outcome : canResolveDispute(u, a) ? <Link className="btn sm primary" href={`/audits/${a.id}`}>Resolve</Link> : <Status s={a.status} />}</td></tr>;
  const head = <thead><tr><th>Case</th><th>Agent</th><th>QA</th><th>Disputed parameters</th><th>Raised</th><th className="r">Actual</th><th></th></tr></thead>;
  return (<><PageHead title="Disputes" sub="Agents can dispute ratings they disagree with. Resolve each one with an outcome and a note; upheld ratings rescore the audit." />
    <h3 style={{ margin: '0 0 8px' }}>Open ({open.length})</h3>{open.length ? <div className="tbl-wrap"><table className="tbl">{head}<tbody>{open.map(row)}</tbody></table></div> : <Empty>No open disputes.</Empty>}
    <h3 style={{ margin: '20px 0 8px' }}>Recently resolved</h3>{done.length ? <div className="tbl-wrap"><table className="tbl">{head}<tbody>{done.map(row)}</tbody></table></div> : <Empty>None yet.</Empty>}</>);
}
