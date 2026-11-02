import Link from 'next/link';
import { db, schema as t } from '@/db';
import { requireUser } from '@/lib/auth';
import { getUsers, nameOf } from '@/lib/data';
import { ROLES, ROLE_KEYS } from '@/lib/rbac';
import { hierarchy } from '@/lib/scope';
import { PageHead, Chip } from '@/components/ui';
import { UserButton } from './UserModal';
import { CompanyLogo } from '@/components/CompanyLogo';
export default async function Users({ searchParams }: { searchParams: { role?: string; co?: string; cl?: string } }) {
  const me = await requireUser('admin.users');
  const h = await hierarchy(me); const lobs = await db.select().from(t.lobs);
  const clientName = (id: string | null) => h.clients.find((c) => c.id === id)?.name || '';
  const coName = (id: string | null) => h.companies.find((c) => c.id === id)?.name || '';
  // company admins see only their company; group admins see everyone
  const all = (await getUsers()).filter((u) => !me.companyId || u.companyId === me.companyId);
  const order = ROLE_KEYS;
  const U = all.filter((u) => (!searchParams.role || u.role === searchParams.role) && (!searchParams.co || (searchParams.co === 'group' ? !u.companyId : u.companyId === searchParams.co)) && (!searchParams.cl || u.clientId === searchParams.cl)).sort((a, b) => order.indexOf(a.role as never) - order.indexOf(b.role as never) || a.name.localeCompare(b.name));
  const tls = all.filter((x) => x.role === 'tl').map((x) => ({ id: x.id, name: x.name, companyId: x.companyId }));
  const org = { companies: h.companies.map((c) => ({ id: c.id, name: c.name })), clients: h.clients.map((c) => ({ id: c.id, name: c.name, companyId: c.companyId, ssoDomains: c.ssoDomains })), lobs: lobs.filter((l) => h.clients.some((c) => c.id === l.clientId)).map((l) => ({ name: l.name, clientId: l.clientId })), myCompany: me.companyId || null };
  const q = (o: Record<string, string | undefined>) => '/admin/users?' + new URLSearchParams(Object.entries({ ...searchParams, ...o }).filter(([, v]) => v) as [string, string][]).toString();
  const tab = (href: string, label: string, on: boolean) => <Link key={href + label} href={href} className={on ? 'on' : ''} style={{ textDecoration: 'none', padding: '6px 10px' }}>{label}</Link>;
  const where = (u: (typeof all)[number]) => u.role === 'client' ? `${coName(u.companyId)} › ${clientName(u.clientId)}` : u.role === 'agent' ? `${coName(u.companyId)} › ${clientName(u.clientId)} · ${u.lob} · ${nameOf(all, u.tlId)}` : u.companyId ? coName(u.companyId) : 'Group-wide';
  return (<>
    <PageHead title="Users & roles" sub="Staff belong to a company (Expenova or PeopleOCity) and see only that company's clients; Admins and Managers can be group-wide. Client stakeholders belong to one client and see only that client's data. Anyone can sign in with Microsoft 365, a password, or both." actions={<><Link className="btn" href="/admin/roles">Roles &amp; permissions</Link><UserButton tls={tls} org={org} /></>} />
    <div className="seg-sm" role="group" aria-label="Company" style={{ marginBottom: 6, flexWrap: 'wrap' }}>{tab(q({ co: undefined, cl: undefined }), `All companies (${all.length})`, !searchParams.co && !searchParams.cl)}{!me.companyId && tab(q({ co: 'group', cl: undefined }), `Group-wide (${all.filter((u) => !u.companyId).length})`, searchParams.co === 'group')}{h.companies.map((c) => tab(q({ co: c.id, cl: undefined }), `${c.name} (${all.filter((u) => u.companyId === c.id).length})`, searchParams.co === c.id))}{h.clients.map((c) => tab(q({ cl: c.id, co: undefined }), `${c.name} (${all.filter((u) => u.clientId === c.id).length})`, searchParams.cl === c.id))}</div>
    <div className="seg-sm" role="group" aria-label="Role" style={{ marginBottom: 10, flexWrap: 'wrap' }}>{tab(q({ role: undefined }), 'All roles', !searchParams.role)}{ROLE_KEYS.map((k) => tab(q({ role: k }), `${k === 'client' ? 'Client stakeholder' : ROLES[k]} (${all.filter((u) => u.role === k).length})`, searchParams.role === k))}</div>
    <div className="card" style={{ padding: 0 }}><div className="tbl-wrap" style={{ border: 0 }}><table className="tbl"><thead><tr><th>Name</th><th>Role</th><th>Company › Client</th><th>Work email</th><th>Username</th><th>Sign-in</th><th>Status</th><th></th></tr></thead><tbody>
      {U.map((u) => <tr key={u.id}><td><b>{u.name}</b>{u.fixed && <Chip>Built-in</Chip>}</td><td><Chip tone="acc">{u.role === 'client' ? 'Client stakeholder' : ROLES[u.role as keyof typeof ROLES]}</Chip></td><td className="small"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{u.companyId && <CompanyLogo id={u.companyId} h={13} />}{where(u)}</span></td><td className="small">{u.email || '—'}</td><td className="mono">{u.username}</td><td>{u.authSso && <Chip>Microsoft 365 / Google{u.ssoOid || u.googleSub ? ' · linked' : ''}</Chip>} {u.authPassword && <Chip>Password</Chip>}</td><td>{u.active ? <Chip tone="good">Active</Chip> : <Chip>Inactive</Chip>}</td><td className="r"><UserButton tls={tls} org={org} user={{ id: u.id, name: u.name, role: u.role, email: u.email || '', username: u.username, authSso: u.authSso, authPassword: u.authPassword, active: u.active, lob: u.lob, tlId: u.tlId, fixed: u.fixed, companyId: u.companyId, clientId: u.clientId }} /></td></tr>)}
    </tbody></table></div></div></>);
}
