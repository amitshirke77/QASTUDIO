'use client';
import { useState } from 'react';
import { saveSettings } from '@/app/actions/admin';
import { useAction } from '@/components/client';
import { CompanyLogo } from '@/components/CompanyLogo';
import { ROLES, ROLE_KEYS } from '@/lib/rbac';

type G = { g: string; role: string; companyId?: string | null };
export function SsoForm({ v, configured, google, multiTenant, companies, clients }: { v: { domains: string; tenantIds?: string; allowManual: boolean; groups: G[] }; configured: boolean; google: boolean; multiTenant: boolean; companies: { id: string; name: string }[]; clients: { name: string; company: string; companyId: string; ssoDomains: string[]; ssoTenantIds: string[] }[] }) {
  const [s, setS] = useState({ ...v, tenantIds: v.tenantIds || '' }); const { run, pending, error } = useAction();
  return <div className="stack" style={{ gap: 14 }}><div className="card stack">
    <div className="note">{configured ? `Microsoft 365 sign-in is on, in ${multiTenant ? 'multi-tenant mode: clients sign in from their own Microsoft 365 tenant, and only the tenant IDs listed here and on each client are accepted' : 'single-tenant mode: staff use their zipstacc accounts and client stakeholders are invited into the zipstacc tenant as guests'}.` : 'Microsoft 365 sign-in is off. Set AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET and AZURE_AD_TENANT_ID on the server to turn it on (see README).'}</div>
    <div className="note">{google ? 'Google sign-in is on. Only Google Workspace accounts are accepted, and only on the staff domains here or a client\'s domains (Master data). Google does not send group membership, so add staff who use Google under Users first.' : 'Google sign-in is off. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server to turn it on (see DEPLOY.md).'}</div>
    <h3 style={{ margin: 0 }}>Staff (Expenova and PeopleOCity)</h3>
    <div className="grid g2"><div className="field"><label htmlFor="sso_d">Staff email domains</label><input id="sso_d" type="text" value={s.domains} onChange={(e) => setS({ ...s, domains: e.target.value })} placeholder="zipstacc.com" /><span className="muted small">Comma separated. Staff sign-in is checked against these domains; a client&apos;s domains are set on the client (Master data).</span></div>
      <div className="field"><label htmlFor="sso_t">Staff Entra tenant ID(s){multiTenant ? ' (required)' : ''}</label><input id="sso_t" type="text" value={s.tenantIds} onChange={(e) => setS({ ...s, tenantIds: e.target.value })} placeholder="zipstacc tenant ID" /></div></div>
    <label className="check"><input type="checkbox" checked={s.allowManual} onChange={(e) => setS({ ...s, allowManual: e.target.checked })} /> Allow username and password sign-in for staff (Admins and client stakeholders can always use a password if their login has one)</label>
    <div><div className="eyebrow">Entra ID group → role and company (first sign-in of a staff member). Use the group object ID.</div>{s.groups.map((g, i) => <div key={i} className="inline-form" style={{ marginTop: 6 }}><input type="text" aria-label="Group" value={g.g} onChange={(e) => setS({ ...s, groups: s.groups.map((x, j) => (j === i ? { ...x, g: e.target.value } : x)) })} style={{ flex: 1 }} /><select aria-label="Role" value={g.role} onChange={(e) => setS({ ...s, groups: s.groups.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)) })}>{ROLE_KEYS.filter((r) => r !== 'client').map((r) => <option key={r} value={r}>{ROLES[r]}</option>)}</select><select aria-label="Company" value={g.companyId || ''} onChange={(e) => setS({ ...s, groups: s.groups.map((x, j) => (j === i ? { ...x, companyId: e.target.value || null } : x)) })}><option value="">Group-wide</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button className="btn ghost sm" aria-label="Remove group" onClick={() => setS({ ...s, groups: s.groups.filter((_, j) => j !== i) })}>✕</button></div>)}<button className="btn sm" style={{ marginTop: 6 }} onClick={() => setS({ ...s, groups: [...s.groups, { g: '', role: 'agent', companyId: companies[0]?.id || null }] })}>Add group</button></div>
    <div className="err">{error}</div><div className="actions"><button className="btn primary" disabled={pending} onClick={() => run(() => saveSettings('sso', s), { success: 'Saved' })}>Save</button></div></div>
    <div className="card stack"><h3 style={{ margin: 0 }}>Client stakeholders</h3><p className="muted small" style={{ margin: 0 }}>Each client&apos;s sign-in domains and tenant are set on the client under Master data. A stakeholder who signs in sees only their own client.</p>
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Company › Client</th><th>Microsoft 365 domains</th><th>Tenant IDs</th></tr></thead><tbody>{clients.map((c) => <tr key={c.name}><td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><CompanyLogo id={c.companyId} name={c.company} h={13} />{c.company} › <b>{c.name}</b></span></td><td>{c.ssoDomains.join(', ') || <span className="muted">not set up</span>}</td><td className="mono small">{c.ssoTenantIds.join(', ') || (multiTenant ? <span className="s-bad">required</span> : '—')}</td></tr>)}</tbody></table></div></div></div>;
}
export function NotifyForm({ v, fb }: { v: { inapp: boolean; email: boolean; teams: boolean }; fb: { deliverH: number; disputeH: number; ackH: number } }) {
  const [s, setS] = useState(v), [f, setF] = useState(fb); const { run, pending, error } = useAction();
  return <div className="grid g2"><div className="card stack"><h3>Channels</h3>
    {([['inapp', 'In-app bell'], ['email', 'Email via Microsoft 365 (Graph sendMail)'], ['teams', 'Microsoft Teams message (channel webhook)']] as const).map(([k, l]) => <label key={k} className="check"><input type="checkbox" checked={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.checked })} /> {l}</label>)}
    <button className="btn" disabled={pending} onClick={() => run(() => saveSettings('notify', s), { success: 'Saved' })}>Save channels</button></div>
    <div className="card stack"><h3>Feedback target times (hours)</h3>{([['deliverH', 'Deliver feedback after the audit'], ['ackH', 'Agent acknowledges after delivery'], ['disputeH', 'Resolve a dispute']] as const).map(([k, l]) => <div key={k} className="field"><label>{l}</label><input type="number" min={1} value={f[k]} onChange={(e) => setF({ ...f, [k]: +e.target.value })} /></div>)}
      <button className="btn" disabled={pending} onClick={() => run(() => saveSettings('feedbackTargets', f), { success: 'Saved' })}>Save targets</button><span className="err">{error}</span></div></div>;
}
const BP: [string, string, string, string?][] = [
  ['disputeWindow', 'Dispute window', 'Audits not acknowledged or disputed within the window are auto-acknowledged.', 'Hours'],
  ['aoiForN', 'Area of improvement for every No', 'An audit cannot be submitted until every No has an area of improvement.'],
  ['versioning', 'Form versioning', 'Form edits create a new version; old audits keep theirs. (Always on in this build.)'],
  ['maskPhone', 'Mask customer phone numbers', 'Client stakeholders see only the last four digits. (Always on for client stakeholder logins in this build.)'],
  ['coaching', 'Coaching below a threshold', 'Audits under this Actual score create a coaching task for the TL. (Recorded here; not yet enforced by the app.)', 'Score %'],
  ['sampling', 'Minimum weekly sampling per agent', 'Minimum calls and emails audited per agent per week. (Recorded here; not yet enforced by the app.)'],
  ['lockAfterAck', 'Lock after acknowledgement', 'An acknowledged audit cannot be edited. (Recorded here; not yet enforced by the app.)'],
  ['calibration', 'Monthly calibration', 'Remind QA Leads when no calibration session has run this month. (Recorded here; not yet enforced by the app.)'],
];
export function BestPractices({ v, canEdit }: { v: Record<string, { status: string; value?: number }>; canEdit: boolean }) {
  const [s, setS] = useState(v); const { run, pending } = useAction();
  const set = (k: string, o: Partial<{ status: string; value: number }>) => { const n = { ...s, [k]: { ...(s[k] || { status: 'pending' }), ...o } }; setS(n); run(() => saveSettings('bp', n), { success: 'Saved' }); };
  return <div className="stack">{BP.map(([k, t, d, unit]) => { const x = s[k] || { status: 'pending' }; return <div key={k} className="card" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}><div style={{ flex: 1, minWidth: 240 }}><h3>{t}</h3><p className="muted small" style={{ margin: '4px 0 0' }}>{d}</p></div>
    {unit && <label className="small">{unit} <input type="number" disabled={!canEdit || pending} defaultValue={x.value} style={{ width: 80 }} onBlur={(e) => +e.target.value !== x.value && set(k, { value: +e.target.value })} /></label>}
    <span className={'chip ' + (x.status === 'approved' ? 'good' : x.status === 'rejected' ? 'bad' : 'warn')}>{x.status === 'approved' ? 'Approved' : x.status === 'rejected' ? 'Not used' : 'Awaiting approval'}</span>
    {canEdit && <span className="actions"><button className="btn sm primary" disabled={pending || x.status === 'approved'} onClick={() => set(k, { status: 'approved' })}>Approve</button><button className="btn sm" disabled={pending || x.status === 'rejected'} onClick={() => set(k, { status: 'rejected' })}>Decline</button></span>}</div>; })}</div>;
}
