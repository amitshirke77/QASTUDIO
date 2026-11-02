import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { applyFilters, getUsers, loadAudits, nameOf, parseFilters } from '@/lib/data';
import { filterOptions } from '@/lib/filters';
import { can } from '@/lib/rbac';
import { FilterBar, Seg } from '@/components/client';
import { PageHead, Score, Status, Empty } from '@/components/ui';
import { fdate } from '@/lib/dates';

export default async function Audits({ searchParams }: { searchParams: Record<string, string> }) {
  const u = await requireUser('audits.list');
  const f = parseFilters(searchParams); const users = await getUsers();
  let A = applyFilters(await loadAudits(u, f.from, f.to, { by: f.by }), f);
  if (u.role === 'auditor' && searchParams.mine !== 'all') A = A.filter((a) => a.auditorId === u.id);
  const st = searchParams.status || ''; if (st) A = A.filter((a) => a.status === st);
  const q = (searchParams.q || '').trim().toLowerCase(); if (q) A = A.filter((a) => (a.caseId + ' ' + nameOf(users, a.agentId)).toLowerCase().includes(q));
  const opts = await filterOptions(u, users);
  return (<>
    <PageHead title={u.role === 'auditor' ? 'My audits' : u.role === 'tl' ? 'Team audits' : 'Audits'} sub={`${A.length} audits`} actions={can(u.role, 'audit.create') ? <Link className="btn primary" href="/audits/new">New audit</Link> : undefined} />
    <FilterBar {...opts} from={f.from} to={f.to} />
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '0 0 12px' }}>
      <Seg k="status" def="" opts={[['', 'All'], ['Pending acknowledgement', 'Pending'], ['Acknowledged', 'Acknowledged'], ['Disputed', 'Disputed'], ['Dispute resolved', 'Resolved']]} />
      {u.role === 'auditor' && <Seg k="mine" def="" opts={[['', 'Mine'], ['all', 'All auditors']]} />}
      <form style={{ marginLeft: 'auto' }}>{Object.entries(searchParams).filter(([k]) => k !== 'q').map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}<input type="search" name="q" defaultValue={searchParams.q || ''} placeholder="Search case ID or agent" aria-label="Search audits" /></form>
    </div>
    {A.length ? <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Audit date</th><th>Case</th><th>Agent</th><th>LOB · product</th><th>Customer</th><th>Type</th><th>QA</th><th className="r">Overall</th><th className="r">Actual</th><th>Status</th></tr></thead><tbody>
      {A.slice(0, 500).map((a) => <tr key={a.id}><td>{fdate(a.auditDate)}</td><td><Link className="rel-link" href={`/audits/${a.id}`}>{a.caseId}</Link></td><td>{nameOf(users, a.agentId)}</td><td className="small">{a.lob} · {a.product}</td><td className="small">{a.customer}</td><td>{a.channel}</td><td className="small">{nameOf(users, a.auditorId)}</td><td className="r"><Score v={a.overall} /></td><td className="r"><Score v={a.actual} fatal={a.fatal} /></td><td><Status s={a.status} /></td></tr>)}
    </tbody></table>{A.length > 500 && <p className="muted small" style={{ padding: 10 }}>Showing the latest 500. Narrow the filters or use Reports to export everything.</p>}</div> : <Empty>No audits match these filters.</Empty>}
  </>);
}
