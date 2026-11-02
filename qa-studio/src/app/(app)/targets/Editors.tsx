'use client';
import { useState } from 'react';
import { savePlanLine, savePlanSettings, saveVolume, saveAuditorTarget, addCustomerProducts } from '@/app/actions/ops';
import { Modal, useAction } from '@/components/client';
type Line = { id: string; customer: string; lob: string; product: string; channel: string; projected: number | null; goLive: string | null; isNew: boolean; rate: number | null; override: number | null; active: boolean };
const num = (s: string) => (s === '' ? null : +s);

export function PlanSettingsForm({ v }: { v: { rates: { Call: number; Email: number }; min: number; newMult: number; ramp: number } }) {
  const [s, setS] = useState(v); const { run, pending, error } = useAction();
  return <div className="card inline-form" style={{ marginTop: 14 }}>
    <div className="field"><label htmlFor="ps_c">Call sampling %</label><input id="ps_c" type="number" step="0.1" value={s.rates.Call} onChange={(e) => setS({ ...s, rates: { ...s.rates, Call: +e.target.value } })} /></div>
    <div className="field"><label htmlFor="ps_e">Email sampling %</label><input id="ps_e" type="number" step="0.1" value={s.rates.Email} onChange={(e) => setS({ ...s, rates: { ...s.rates, Email: +e.target.value } })} /></div>
    <div className="field"><label htmlFor="ps_m">Minimum per line</label><input id="ps_m" type="number" value={s.min} onChange={(e) => setS({ ...s, min: +e.target.value })} /></div>
    <div className="field"><label htmlFor="ps_x">New-line multiplier</label><input id="ps_x" type="number" step="0.1" value={s.newMult} onChange={(e) => setS({ ...s, newMult: +e.target.value })} /></div>
    <div className="field"><label htmlFor="ps_r">Ramp-up months</label><input id="ps_r" type="number" value={s.ramp} onChange={(e) => setS({ ...s, ramp: +e.target.value })} /></div>
    <button className="btn" disabled={pending} onClick={() => run(() => savePlanSettings(s), { success: 'Plan settings saved' })}>Save</button><span className="err">{error}</span></div>;
}
export function VolumeCell({ line, month, v }: { line: Line; month: string; v: number | null }) {
  const [x, setX] = useState(v == null ? '' : String(v)); const { run } = useAction();
  return <input aria-label={`Volume ${month}`} type="number" min={0} value={x} style={{ width: 80, textAlign: 'right' }} onChange={(e) => setX(e.target.value)} onBlur={() => x !== '' && +x !== v && run(() => saveVolume(line.customer, line.lob, line.product, line.channel, month, +x), { success: 'Volume saved' })} />;
}
export function LineEditor({ line, customers, products }: { line?: Line; customers: string[]; products: [string, string][] }) {
  const [open, setOpen] = useState(false); const { run, pending, error } = useAction();
  const [l, setL] = useState<Omit<Line, 'id'> & { id?: string }>(line || { customer: customers[0] || '', lob: 'Tripstacc', product: products.find((p) => p[0] === 'Tripstacc')?.[1] || '', channel: 'Call', projected: null, goLive: null, isNew: true, rate: null, override: null, active: true });
  return <>{line ? <button className="btn ghost sm" onClick={() => setOpen(true)}>Edit</button> : <button className="btn sm" onClick={() => setOpen(true)}>Add line</button>}
    {open && <Modal title={line ? 'Edit plan line' : 'Add a plan line'} onClose={() => setOpen(false)} foot={<><button className="btn" onClick={() => setOpen(false)}>Cancel</button><button className="btn primary" disabled={pending} onClick={() => run(() => savePlanLine({ ...l, channel: l.channel as 'Call' | 'Email' }), { success: 'Saved', then: () => setOpen(false) })}>Save</button></>}>
      <div className="grid g2">
        <div className="field"><label htmlFor="pl_c">Customer</label><select id="pl_c" value={l.customer} onChange={(e) => setL({ ...l, customer: e.target.value })}>{customers.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div className="field"><label htmlFor="pl_l">LOB</label><select id="pl_l" value={l.lob} onChange={(e) => setL({ ...l, lob: e.target.value, product: products.find((p) => p[0] === e.target.value)?.[1] || '' })}>{[...new Set(products.map((p) => p[0]))].map((x) => <option key={x}>{x}</option>)}</select></div>
        <div className="field"><label htmlFor="pl_p">Product</label><select id="pl_p" value={l.product} onChange={(e) => setL({ ...l, product: e.target.value })}>{products.filter((p) => p[0] === l.lob).map((p) => <option key={p[1]}>{p[1]}</option>)}</select></div>
        <div className="field"><label htmlFor="pl_ch">Channel</label><select id="pl_ch" value={l.channel} onChange={(e) => setL({ ...l, channel: e.target.value })}><option>Call</option><option>Email</option></select></div>
        <div className="field"><label htmlFor="pl_pr">Projected monthly volume (new lines)</label><input id="pl_pr" type="number" value={l.projected ?? ''} onChange={(e) => setL({ ...l, projected: num(e.target.value) })} /></div>
        <div className="field"><label htmlFor="pl_g">Go-live date</label><input id="pl_g" type="date" value={l.goLive ?? ''} onChange={(e) => setL({ ...l, goLive: e.target.value || null })} /></div>
        <div className="field"><label htmlFor="pl_r">Sampling % override</label><input id="pl_r" type="number" step="0.1" value={l.rate ?? ''} onChange={(e) => setL({ ...l, rate: num(e.target.value) })} /></div>
        <div className="field"><label htmlFor="pl_o">Fixed audits / month</label><input id="pl_o" type="number" value={l.override ?? ''} onChange={(e) => setL({ ...l, override: num(e.target.value) })} /></div>
      </div>
      <label className="check"><input type="checkbox" checked={l.isNew} onChange={(e) => setL({ ...l, isNew: e.target.checked })} /> New line (ramp-up applies)</label>
      <label className="check"><input type="checkbox" checked={l.active} onChange={(e) => setL({ ...l, active: e.target.checked })} /> Active</label>
      <div className="err" role="alert">{error}</div></Modal>}</>;
}
type Pick = { lob: string; product: string; calls: string; emails: string };
/** Add a new (or existing) customer of a client with several products at once, across that client's LOBs; each product gets its own projected volumes. */
export function NewCustomerProducts({ clients, customers, products, lobs: lobRows }: { clients: { id: string; name: string }[]; customers: { name: string; clientId: string }[]; products: [string, string][]; lobs: { name: string; clientId: string | null }[] }) {
  const [open, setOpen] = useState(false); const { run, pending, error } = useAction();
  const [clientId, setClientId] = useState(clients[0]?.id || ''); const [client, setClient] = useState(''); const [goLive, setGoLive] = useState(new Date().toISOString().slice(0, 10));
  const [extra, setExtra] = useState<[string, string][]>([]); const [picks, setPicks] = useState<Pick[]>([]);
  const [nl, setNl] = useState(''); const [np, setNp] = useState(''); const [msg, setMsg] = useState('');
  const own = new Set(lobRows.filter((l) => l.clientId === clientId).map((l) => l.name));
  const all = [...products.filter((p) => own.has(p[0])), ...extra]; const lobs = [...new Set([...own, ...all.map((p) => p[0])])];
  const key = (l: string, p: string) => l + '|' + p; const on = (l: string, p: string) => picks.some((x) => key(x.lob, x.product) === key(l, p));
  const toggle = (l: string, p: string, v: boolean) => setPicks(v ? [...picks, { lob: l, product: p, calls: '', emails: '' }] : picks.filter((x) => key(x.lob, x.product) !== key(l, p)));
  const setVol = (i: number, k: 'calls' | 'emails', v: string) => setPicks(picks.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const addNew = () => {
    if (!nl.trim() || !np.trim()) { setMsg('Enter the LOB and the new product name.'); return; }
    const lob = lobs.find((l) => l.toLowerCase() === nl.trim().toLowerCase()) || nl.trim().charAt(0).toUpperCase() + nl.trim().slice(1);
    const prod = all.find((p) => p[0] === lob && p[1].toLowerCase() === np.trim().toLowerCase())?.[1] || np.trim();
    if (!all.some((p) => p[0] === lob && p[1] === prod)) setExtra([...extra, [lob, prod]]);
    if (!on(lob, prod)) setPicks([...picks, { lob, product: prod, calls: '', emails: '' }]);
    setNl(''); setNp(''); setMsg('');
  };
  const reset = () => { setClient(''); setPicks([]); setExtra([]); setMsg(''); setOpen(false); };
  const save = () => run(() => addCustomerProducts({ clientId, customer: client, goLive, items: picks.map((x) => ({ lob: x.lob, product: x.product, calls: +x.calls || 0, emails: +x.emails || 0 })) }), { success: `Added ${client.toUpperCase()}: ${picks.length} product${picks.length > 1 ? 's' : ''} on the plan`, then: reset });
  return <><button className="btn sm" onClick={() => setOpen(true)}>Add customer / products</button>
    {open && <Modal title="Add a customer with its products" onClose={() => setOpen(false)} foot={<><button className="btn" onClick={() => setOpen(false)}>Cancel</button><button className="btn primary" disabled={pending || !picks.length} onClick={save}>{picks.length ? `Add ${picks.length} product${picks.length > 1 ? 's' : ''} to plan` : 'Tick at least one product'}</button></>}>
      <p className="muted small" style={{ marginTop: 0 }}>Pick the client, then an existing customer or a new one, and tick every product the customer takes, across the client's LOBs. Each product gets its own projected calls and emails and is targeted on projection, with the ramp-up multiplier, until real volume builds up. New customers, LOBs and products are added to Master data under that client.</p>
      <div className="grid g2">
        <div className="field"><label htmlFor="nc_cl_sel">Client</label><select id="nc_cl_sel" value={clientId} onChange={(e) => { setClientId(e.target.value); setPicks([]); setExtra([]); }}>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="field"><label htmlFor="nc_c">Customer</label><input id="nc_c" type="text" list="nc_cl" value={client} onChange={(e) => setClient(e.target.value)} placeholder="e.g. KOTAK" /><datalist id="nc_cl">{customers.filter((c) => c.clientId === clientId).map((c) => <option key={c.name} value={c.name} />)}</datalist></div>
        <div className="field"><label htmlFor="nc_g">Go-live date</label><input id="nc_g" type="date" value={goLive} onChange={(e) => setGoLive(e.target.value)} /></div>
      </div>
      <fieldset style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '10px 14px', margin: '12px 0' }}><legend className="small" style={{ padding: '0 6px' }}><b>Products</b> <span className="muted">· tick every product this customer takes ({picks.length} selected)</span></legend>
        {lobs.map((l) => <div key={l} style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', alignItems: 'center', margin: '6px 0' }}><span className="muted small" style={{ minWidth: 86 }}>{l}</span>
          {all.filter((p) => p[0] === l).map((p) => <label key={p[1]} className="check small"><input type="checkbox" checked={on(l, p[1])} onChange={(e) => toggle(l, p[1], e.target.checked)} /> {p[1]}</label>)}</div>)}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'end', marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--line)' }}>
          <div className="field" style={{ margin: 0 }}><label htmlFor="nc_nl" className="small">New product: LOB</label><input id="nc_nl" type="text" list="nc_ll" value={nl} onChange={(e) => setNl(e.target.value)} placeholder="Tripstacc" style={{ width: 140 }} /><datalist id="nc_ll">{lobs.map((l) => <option key={l} value={l} />)}</datalist></div>
          <div className="field" style={{ margin: 0 }}><label htmlFor="nc_np" className="small">Product name</label><input id="nc_np" type="text" value={np} onChange={(e) => setNp(e.target.value)} placeholder="e.g. Holidays" style={{ width: 160 }} /></div>
          <button className="btn sm" type="button" onClick={addNew}>Add product</button></div>
      </fieldset>
      {picks.length > 0 && <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Product</th><th>LOB</th><th className="r">Projected calls / month</th><th className="r">Projected emails / month</th><th /></tr></thead><tbody>
        {picks.map((x, i) => <tr key={key(x.lob, x.product)}><td><b>{x.product}</b></td><td>{x.lob}</td>
          <td className="r"><input type="number" min={0} aria-label={`Projected calls for ${x.product}`} placeholder="0 = none" value={x.calls} onChange={(e) => setVol(i, 'calls', e.target.value)} style={{ width: 120, textAlign: 'right' }} /></td>
          <td className="r"><input type="number" min={0} aria-label={`Projected emails for ${x.product}`} placeholder="0 = none" value={x.emails} onChange={(e) => setVol(i, 'emails', e.target.value)} style={{ width: 120, textAlign: 'right' }} /></td>
          <td className="r"><button className="btn ghost sm" type="button" aria-label={`Remove ${x.product}`} onClick={() => toggle(x.lob, x.product, false)}>✕</button></td></tr>)}
      </tbody></table></div>}
      <div className="err" role="alert">{msg || error}</div></Modal>}</>;
}
type Cfg = { period: string; share: number; lobs: string[]; overrideCalls: number | null; overrideEmails: number | null };
export function TargetRow({ edit, name, userId, cfg, calls, emails, planCalls, planEmails, lobs }: { lobs: string[]; edit: boolean; name: string; userId: string; cfg: Cfg | null; calls: number; emails: number; planCalls: number; planEmails: number }) {
  const [c, setC] = useState<Cfg>(cfg || { period: 'Weekly', share: 0, lobs, overrideCalls: null, overrideEmails: null }); const { run, pending } = useAction();
  if (!edit) return <tr><td>{name}</td><td>{c.period}</td><td className="r mono">{c.share}</td><td>{c.lobs.join(', ')}</td><td className="r mono">{calls}</td><td className="r mono">{emails}</td><td /></tr>;
  return <tr><td>{name}</td><td><select aria-label="Period" value={c.period} onChange={(e) => setC({ ...c, period: e.target.value })}><option>Weekly</option><option>Monthly</option></select></td>
    <td className="r"><input aria-label="Share" type="number" step="0.1" min={0} value={c.share} style={{ width: 70 }} onChange={(e) => setC({ ...c, share: +e.target.value })} /></td>
    <td>{lobs.map((l) => <label key={l} className="check small"><input type="checkbox" checked={c.lobs.includes(l)} onChange={(e) => setC({ ...c, lobs: e.target.checked ? [...c.lobs, l] : c.lobs.filter((x) => x !== l) })} /> {l}</label>)}</td>
    <td className="r"><input aria-label="Call override" type="number" placeholder={String(planCalls)} value={c.overrideCalls ?? ''} style={{ width: 70 }} onChange={(e) => setC({ ...c, overrideCalls: num(e.target.value) })} /> <span className="mono small">{calls}</span></td>
    <td className="r"><input aria-label="Email override" type="number" placeholder={String(planEmails)} value={c.overrideEmails ?? ''} style={{ width: 70 }} onChange={(e) => setC({ ...c, overrideEmails: num(e.target.value) })} /> <span className="mono small">{emails}</span></td>
    <td className="r"><button className="btn sm" disabled={pending} onClick={() => run(() => saveAuditorTarget({ userId, ...c, period: c.period as 'Weekly' }), { success: 'Target saved' })}>Save</button></td></tr>;
}
