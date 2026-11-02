'use client';
import { useState } from 'react';
import { addCompany, addClient, updateClient, addCustomer, toggleCustomer, addLob, addProduct } from '@/app/actions/admin';
import { useAction } from '@/components/client';
import { CompanyLogo } from '@/components/CompanyLogo';

type Co = { id: string; name: string };
type Cl = { id: string; companyId: string; name: string; ssoDomains: string[]; ssoTenantIds: string[]; autoProvision: boolean; active: boolean; users: number };
type Cu = { id: string; clientId: string; name: string; active: boolean };
type Lob = { name: string; clientId: string | null };
type Pr = { lob: string; name: string };

/** Company › Client › Customer › LOB › Product. Each client also carries its Microsoft 365 sign-in domains. */
export function Masters({ companies, clients, customers, lobs, products, groupAdmin, multiTenant }: { companies: Co[]; clients: Cl[]; customers: Cu[]; lobs: Lob[]; products: Pr[]; groupAdmin: boolean; multiTenant: boolean }) {
  const { run, pending, error } = useAction();
  const [co, setCo] = useState(''); const [newCl, setNewCl] = useState<Record<string, string>>({});
  return <div className="stack" style={{ gap: 14 }}>
    <div className="note">The hierarchy is <b>Company › Client › Customer › LOB › Product</b>. Clients are the businesses we run quality for (CUSTCAP for Expenova, UPPERCASE for PeopleOCity). Customers are the client&apos;s own customers that appear on audits (for example IDFCFIRST or AMEX). Each client&apos;s stakeholders see only that client&apos;s data.</div>
    {companies.map((c) => <section key={c.id} className="card stack" aria-label={c.name}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><CompanyLogo id={c.id} name={c.name} h={28} /><div><div className="eyebrow">Company</div><h2 style={{ margin: 0 }}>{c.name}</h2></div></div>
        <div className="inline-form"><input type="text" aria-label={`New client for ${c.name}`} placeholder="New client" value={newCl[c.id] || ''} onChange={(e) => setNewCl({ ...newCl, [c.id]: e.target.value })} /><button className="btn sm" disabled={pending} onClick={() => run(() => addClient(c.id, newCl[c.id] || ''), { success: 'Client added', then: () => setNewCl({ ...newCl, [c.id]: '' }) })}>Add client</button></div></div>
      {clients.filter((x) => x.companyId === c.id).map((cl) => <ClientCard key={cl.id} cl={cl} customers={customers.filter((x) => x.clientId === cl.id)} lobs={lobs.filter((l) => l.clientId === cl.id).map((l) => l.name)} products={products} multiTenant={multiTenant} />)}
      {!clients.some((x) => x.companyId === c.id) && <p className="muted small" style={{ margin: 0 }}>No clients yet.</p>}
    </section>)}
    {groupAdmin && <div className="inline-form"><input type="text" aria-label="New company" placeholder="New company" value={co} onChange={(e) => setCo(e.target.value)} /><button className="btn sm" disabled={pending} onClick={() => run(() => addCompany(co), { success: 'Company added', then: () => setCo('') })}>Add company</button></div>}
    <div className="err" role="alert">{error}</div>
  </div>;
}

function ClientCard({ cl, customers, lobs, products, multiTenant }: { cl: Cl; customers: Cu[]; lobs: string[]; products: Pr[]; multiTenant: boolean }) {
  const { run, pending, error } = useAction();
  const [cu, setCu] = useState(''), [lob, setLob] = useState(''), [pl, setPl] = useState(lobs[0] || ''), [pr, setPr] = useState('');
  const [sso, setSso] = useState({ d: cl.ssoDomains.join(', '), t: cl.ssoTenantIds.join(', '), auto: cl.autoProvision, active: cl.active });
  const split = (v: string) => v.split(/[,\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  return <div className="card stack" style={{ background: 'var(--bg, transparent)', borderStyle: 'dashed' }} aria-label={`Client ${cl.name}`}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}><div><div className="eyebrow">Client</div><h3 style={{ margin: 0 }}>{cl.name} {!cl.active && <span className="chip">Inactive</span>}</h3><span className="muted small">{cl.users} stakeholder login{cl.users === 1 ? '' : 's'} · {customers.length} customers · {lobs.length} LOBs</span></div></div>
    <div className="grid g2">
      <div className="stack" style={{ gap: 6 }}><b className="small">Customers</b>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{customers.map((x) => <button key={x.id} className={'chip ' + (x.active ? 'acc' : '')} title={x.active ? 'Click to deactivate' : 'Click to activate'} disabled={pending} onClick={() => run(() => toggleCustomer(x.id, !x.active))} style={{ cursor: 'pointer', textDecoration: x.active ? 'none' : 'line-through' }}>{x.name}</button>)}{!customers.length && <span className="muted small">None yet</span>}</div>
        <div className="inline-form"><input type="text" aria-label={`New customer for ${cl.name}`} placeholder="New customer, e.g. KOTAK" value={cu} onChange={(e) => setCu(e.target.value)} /><button className="btn sm" disabled={pending} onClick={() => run(() => addCustomer(cl.id, cu), { success: 'Customer added', then: () => setCu('') })}>Add</button></div></div>
      <div className="stack" style={{ gap: 6 }}><b className="small">LOBs and products</b>
        {lobs.map((l) => <div key={l} className="small"><b>{l}</b>: {products.filter((p) => p.lob === l).map((p) => p.name).join(', ') || <span className="muted">no products</span>}</div>)}{!lobs.length && <span className="muted small">None yet</span>}
        <div className="inline-form"><input type="text" aria-label={`New LOB for ${cl.name}`} placeholder="New LOB" value={lob} onChange={(e) => setLob(e.target.value)} /><button className="btn sm" disabled={pending} onClick={() => run(() => addLob(cl.id, lob), { success: 'LOB added', then: () => { setPl(lob); setLob(''); } })}>Add LOB</button></div>
        {lobs.length > 0 && <div className="inline-form"><select aria-label={`LOB for new product (${cl.name})`} value={pl} onChange={(e) => setPl(e.target.value)}>{lobs.map((l) => <option key={l}>{l}</option>)}</select><input type="text" aria-label={`New product for ${cl.name}`} placeholder="New product" value={pr} onChange={(e) => setPr(e.target.value)} /><button className="btn sm" disabled={pending} onClick={() => run(() => addProduct(pl || lobs[0], pr), { success: 'Product added', then: () => setPr('') })}>Add product</button></div>}</div>
    </div>
    <details><summary className="small"><b>Microsoft 365 / Google sign-in for {cl.name} stakeholders</b> <span className="muted">{cl.ssoDomains.length ? cl.ssoDomains.join(', ') : 'not set up'}</span></summary>
      <div className="grid g2" style={{ marginTop: 8 }}>
        <div className="field"><label htmlFor={`d_${cl.id}`}>Email domains</label><input id={`d_${cl.id}`} type="text" value={sso.d} onChange={(e) => setSso({ ...sso, d: e.target.value })} placeholder="customer-capital.com" /><span className="muted small">People with these work emails sign in with Microsoft 365 or Google Workspace and see only {cl.name}.</span></div>
        <div className="field"><label htmlFor={`t_${cl.id}`}>Entra tenant ID(s){multiTenant ? ' (required)' : ' (only for own-tenant sign-in)'}</label><input id={`t_${cl.id}`} type="text" value={sso.t} onChange={(e) => setSso({ ...sso, t: e.target.value })} placeholder="00000000-0000-0000-0000-000000000000" /><span className="muted small">{multiTenant ? 'The app accepts other tenants, so only listed tenants can sign in.' : 'Not needed while client stakeholders are invited as guests into the zipstacc tenant.'}</span></div>
      </div>
      <label className="check"><input type="checkbox" checked={sso.auto} onChange={(e) => setSso({ ...sso, auto: e.target.checked })} /> Create a read-only stakeholder login automatically on first Microsoft 365 sign-in (otherwise add each person under Users)</label>
      <label className="check"><input type="checkbox" checked={sso.active} onChange={(e) => setSso({ ...sso, active: e.target.checked })} /> Client active</label>
      <div><button className="btn sm primary" disabled={pending} onClick={() => run(() => updateClient(cl.id, { ssoDomains: split(sso.d), ssoTenantIds: split(sso.t), autoProvision: sso.auto, active: sso.active }), { success: 'Sign-in settings saved' })}>Save sign-in settings</button></div>
    </details>
    <div className="err" role="alert">{error}</div>
  </div>;
}
