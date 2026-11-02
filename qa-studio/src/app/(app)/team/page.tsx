import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { getUsers, loadAudits } from '@/lib/data';
import { addDays, today, weekEnding } from '@/lib/dates';
import { avg } from '@/lib/util';
import { PageHead, Score, Kpi, pct, scls } from '@/components/ui';
export default async function Team() {
  const u = await requireRole('tl');
  const users = await getUsers(); const team = users.filter((x) => x.role === 'agent' && x.tlId === u.id);
  const A = (await loadAudits(u, addDays(today(), -60), today())).filter((a) => a.tlId === u.id);
  const mtd = A.filter((a) => a.auditDate.slice(0, 7) === today().slice(0, 7)), wk = A.filter((a) => a.weekEnding === weekEnding(today()));
  return (<>
    <PageHead title="My team" sub={`${team.length} agents · last 60 days`} actions={<Link className="btn primary" href="/audits/new">Audit a team member</Link>} />
    <div className="kpis"><Kpi label="Audits MTD" value={mtd.length} /><Kpi label="Actual MTD" value={pct(avg(mtd.map((a) => a.actual)))} cls={scls(avg(mtd.map((a) => a.actual)))} /><Kpi label="This week" value={wk.length} sub={pct(avg(wk.map((a) => a.actual)))} /><Kpi label="Pending acknowledgement" value={A.filter((a) => a.status === 'Pending acknowledgement').length} href="/tracker" /></div>
    <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Agent</th><th>LOB</th><th className="r">Audits</th><th className="r">Overall</th><th className="r">Actual</th><th className="r">Fatals</th><th className="r">Pending ack</th><th></th></tr></thead><tbody>
      {team.map((ag) => { const v = A.filter((a) => a.agentId === ag.id); return <tr key={ag.id}><td><Link className="rel-link" href={`/dashboard?agent=${ag.id}`}>{ag.name}</Link></td><td>{ag.lob}</td><td className="r mono">{v.length}</td><td className="r"><Score v={avg(v.map((a) => a.overall))} /></td><td className="r"><Score v={avg(v.map((a) => a.actual))} /></td><td className="r mono">{v.filter((a) => a.fatal).length}</td><td className="r mono">{v.filter((a) => a.status === 'Pending acknowledgement').length}</td><td className="r"><Link className="btn sm" href={`/audits?agent=${ag.id}`}>Audits</Link></td></tr>; })}
    </tbody></table></div></>);
}
