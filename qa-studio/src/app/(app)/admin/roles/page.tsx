import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getUsers } from '@/lib/data';
import { MATRIX, ROLES, ROLE_KEYS } from '@/lib/rbac';
import { PageHead } from '@/components/ui';
export default async function Roles() {
  await requireUser('admin.users'); const users = await getUsers();
  const order = ['admin', 'manager', 'qalead', 'auditor', 'tl', 'agent', 'client'] as const;
  return (<>
    <PageHead title="Roles & permissions" sub="What each role can do. QA Auditors audit every agent; Team Leaders audit only the agents mapped to them. Agents are classified by LOB (Tripstacc or Shopstacc), which decides their forms, products and briefings. Assign roles on the Users page or through Entra ID groups under Login & SSO. These rules are enforced on the server." actions={<Link className="btn" href="/admin/users">Open Users</Link>} />
    <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))' }}>{order.map((k) => <Link key={k} href={`/admin/users?role=${k}`} className="kpi click" style={{ textDecoration: 'none' }}><span className="l">{ROLES[k]}</span><span className="v">{users.filter((u) => u.role === k && u.active).length}</span><span className="muted small">{k === 'agent' ? `${users.filter((u) => u.role === 'agent' && u.lob === 'Tripstacc').length} Tripstacc · ${users.filter((u) => u.role === 'agent' && u.lob === 'Shopstacc').length} Shopstacc` : 'active users'}</span></Link>)}</div>
    <div className="card" style={{ padding: 0 }}><div className="tbl-wrap" style={{ border: 0 }}><table className="tbl roles-tbl"><thead><tr><th>Capability</th>{order.map((k) => <th key={k} className="c">{ROLES[k]}</th>)}</tr></thead><tbody>{MATRIX.map(([cap, ...v]) => <tr key={cap}><td>{cap}</td>{v.map((x, i) => <td key={i} className="c">{x === '✓' ? <span className="chip good">✓</span> : x === '—' ? <span className="muted">—</span> : <span className="small">{x}</span>}</td>)}</tr>)}</tbody></table></div></div>
    <p className="muted small" style={{ marginTop: 8 }}>{ROLE_KEYS.length} roles.</p></>);
}
