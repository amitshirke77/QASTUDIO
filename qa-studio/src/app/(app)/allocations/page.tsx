import { desc } from 'drizzle-orm';
import { db, schema as t } from '@/db';
import { requireUser } from '@/lib/auth';
import { getUsers, nameOf } from '@/lib/data';
import { fdate, today } from '@/lib/dates';
import { ActionButton } from '@/components/client';
import { cancelAllocation } from '@/app/actions/ops';
import { PageHead, Chip } from '@/components/ui';
import AllocForm from './AllocForm';
import { visibleUsers } from '@/lib/scope';
export default async function Allocations() {
  const u = await requireUser('allocate');
  const all = await getUsers(); const users = await visibleUsers(u, all); const ids = new Set(users.map((x) => x.id));
  const rows = (await db.select().from(t.allocations).orderBy(desc(t.allocations.createdAt)).limit(600)).filter((x) => ids.has(x.agentId)).slice(0, 300);
  return (<>
    <PageHead title="Allocations" sub="Allocate audits of specific agents to an auditor. They appear in the auditor's queue and count toward their target." />
    <AllocForm agents={users.filter((x) => x.role === 'agent' && x.active).map((x) => ({ id: x.id, name: x.name, lob: x.lob || '' }))} auditors={users.filter((x) => ['auditor', 'qalead'].includes(x.role) && x.active).map((x) => ({ id: x.id, name: x.name }))} />
    <div className="tbl-wrap" style={{ marginTop: 14 }}><table className="tbl"><thead><tr><th>Agent</th><th>Auditor</th><th>Type</th><th>Due</th><th>Status</th><th>Note</th><th></th></tr></thead><tbody>
      {rows.map((x) => <tr key={x.id}><td>{nameOf(users, x.agentId)}</td><td>{nameOf(users, x.auditorId)}</td><td>{x.channel}</td><td>{fdate(x.dueDate)}</td><td><Chip tone={x.status === 'Done' ? 'good' : x.status === 'Pending' ? (x.dueDate < today() ? 'bad' : 'warn') : ''}>{x.status === 'Pending' && x.dueDate < today() ? 'Overdue' : x.status}</Chip></td><td className="small">{x.note}</td><td className="r">{x.status === 'Pending' && <ActionButton className="sm ghost" label="Cancel" action={cancelAllocation} args={[x.id]} />}</td></tr>)}
    </tbody></table></div></>);
}
