'use client';
import { useState } from 'react';
import { saveUser } from '@/app/actions/admin';
import { Modal, useAction } from '@/components/client';
import { ROLES, ROLE_KEYS } from '@/lib/rbac';
type U = { id?: string; name: string; role: string; email: string; username: string; authSso: boolean; authPassword: boolean; active: boolean; lob: string | null; tlId: string | null; fixed?: boolean; companyId: string | null; clientId: string | null };
export type Org = { companies: { id: string; name: string }[]; clients: { id: string; name: string; companyId: string; ssoDomains: string[] }[]; lobs: { name: string; clientId: string | null }[]; myCompany: string | null };

export function UserButton({ user, tls, org }: { user?: U; tls: { id: string; name: string; companyId: string | null }[]; org: Org }) {
  const [open, setOpen] = useState(false); const { run, pending, error } = useAction();
  const firstClient = org.clients[0];
  const [u, setU] = useState<U & { password: string }>({ ...(user || { name: '', role: 'agent', email: '', username: '', authSso: true, authPassword: true, active: true, lob: org.lobs.find((l) => l.clientId === firstClient?.id)?.name || null, tlId: null, companyId: org.myCompany || firstClient?.companyId || null, clientId: firstClient?.id || null }), password: '' });
  const f = user?.fixed; const cl = org.clients.find((c) => c.id === u.clientId);
  const scoped = u.role === 'client' || u.role === 'agent';
  const lobs = org.lobs.filter((l) => l.clientId === u.clientId);
  const tlOpts = tls.filter((t) => !cl || t.companyId === cl.companyId);
  const setClient = (id: string) => { const c = org.clients.find((x) => x.id === id); setU({ ...u, clientId: id, companyId: c?.companyId || null, lob: org.lobs.find((l) => l.clientId === id)?.name || null, tlId: null }); };
  return (<>{user ? <button className="btn sm" onClick={() => setOpen(true)}>Edit</button> : <button className="btn primary" onClick={() => setOpen(true)}>Add user</button>}
    {open && <Modal title={user ? 'Edit user' : 'Add user'} onClose={() => setOpen(false)} foot={<><button className="btn" onClick={() => setOpen(false)}>Cancel</button><button className="btn primary" disabled={pending} onClick={() => run(() => saveUser({ ...u, role: u.role as 'agent', password: u.password || undefined, tlId: u.role === 'agent' ? u.tlId || tlOpts[0]?.id || null : null }), { success: 'Saved', then: () => setOpen(false) })}>Save</button></>}>
      {f && <div className="note">This is a built-in login. Only the password can be changed.</div>}
      <div className="grid g2">
        <div className="field"><label htmlFor="u_name">Full name</label><input id="u_name" type="text" readOnly={f} value={u.name} onChange={(e) => setU({ ...u, name: e.target.value })} /></div>
        <div className="field"><label htmlFor="u_role">Role</label><select id="u_role" disabled={f} value={u.role} onChange={(e) => { const r = e.target.value; setU({ ...u, role: r, ...(r === 'client' ? { authPassword: true } : {}) }); }}>{ROLE_KEYS.map((r) => <option key={r} value={r}>{r === 'client' ? 'Client stakeholder' : ROLES[r]}</option>)}</select></div>
        {scoped ? <div className="field"><label htmlFor="u_client">{u.role === 'client' ? 'Client (sees only this client\'s data)' : 'Client program'}</label><select id="u_client" disabled={f} value={u.clientId || ''} onChange={(e) => setClient(e.target.value)}>{org.companies.map((co) => <optgroup key={co.id} label={co.name}>{org.clients.filter((c) => c.companyId === co.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>)}</select></div>
          : <div className="field"><label htmlFor="u_co">Company</label><select id="u_co" disabled={f || !!org.myCompany} value={u.companyId || ''} onChange={(e) => setU({ ...u, companyId: e.target.value || null })}>{!org.myCompany && <option value="">Group-wide (every company)</option>}{org.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><span className="muted small">Staff see only their company&apos;s clients. Group-wide is for Admins and Managers.</span></div>}
        <div className="field"><label htmlFor="u_email">Microsoft 365 work email</label><input id="u_email" type="email" readOnly={f} value={u.email} onChange={(e) => setU({ ...u, email: e.target.value })} placeholder={u.role === 'client' ? 'name@' + (cl?.ssoDomains[0] || 'client-domain.com') : 'name@zipstacc.com'} /></div>
        <div className="field"><label htmlFor="u_user">Username</label><input id="u_user" type="text" readOnly={f} value={u.username} onChange={(e) => setU({ ...u, username: e.target.value })} /></div>
        <div className="field"><label htmlFor="u_pass">{user ? 'New password (leave blank to keep)' : 'Password'}</label><input id="u_pass" type="password" autoComplete="new-password" value={u.password} onChange={(e) => setU({ ...u, password: e.target.value })} placeholder="At least 8 characters" /></div>
        {u.role === 'agent' && <><div className="field"><label htmlFor="u_lob">LOB</label><select id="u_lob" value={u.lob || ''} onChange={(e) => setU({ ...u, lob: e.target.value })}>{lobs.length ? lobs.map((l) => <option key={l.name}>{l.name}</option>) : <option value="">Add an LOB for this client first</option>}</select></div>
          <div className="field"><label htmlFor="u_tl">Team leader</label><select id="u_tl" value={u.tlId || tlOpts[0]?.id || ''} onChange={(e) => setU({ ...u, tlId: e.target.value })}>{tlOpts.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div></>}
      </div>
      {u.role === 'client' && cl && <p className="muted small" style={{ margin: 0 }}>{cl.ssoDomains.length ? `Microsoft 365 sign-in works for ${cl.ssoDomains.join(', ')} accounts.` : `Set ${cl.name}'s Microsoft 365 domain under Master data › Clients to allow Microsoft 365 sign-in.`} A client stakeholder sees the dashboard, trends, client reports and audits of {cl.name} only, with phone numbers masked.</p>}
      {!f && <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}><label className="check"><input type="checkbox" checked={u.authSso} onChange={(e) => setU({ ...u, authSso: e.target.checked })} /> Microsoft 365 sign-in</label><label className="check"><input type="checkbox" checked={u.authPassword} onChange={(e) => setU({ ...u, authPassword: e.target.checked })} /> Password sign-in</label><label className="check"><input type="checkbox" checked={u.active} onChange={(e) => setU({ ...u, active: e.target.checked })} /> Active</label></div>}
      <div className="err" role="alert">{error}</div></Modal>}</>);
}
