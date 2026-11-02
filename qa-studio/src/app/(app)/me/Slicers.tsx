'use client';
import { useRouter, useSearchParams } from 'next/navigation';
export function Slicers({ v, customers }: { v: { from: string; to: string; customer: string; channel: string }; customers: string[] }) {
  const r = useRouter(), sp = useSearchParams();
  const set = (k: string, val: string) => { const n = new URLSearchParams(sp.toString()); if (val) n.set(k, val); else n.delete(k); r.push('/me?' + n); };
  return <div className="ag-slicers">
    <div className="field"><label htmlFor="af_from">From</label><input type="date" id="af_from" defaultValue={v.from} onChange={(e) => e.target.value && set('from', e.target.value)} /></div>
    <div className="field"><label htmlFor="af_to">To</label><input type="date" id="af_to" defaultValue={v.to} onChange={(e) => e.target.value && set('to', e.target.value)} /></div>
    <div className="field"><label htmlFor="af_customer">Customer</label><select id="af_customer" value={v.customer} onChange={(e) => set('customer', e.target.value)}><option value="">All customers</option>{customers.map((c) => <option key={c}>{c}</option>)}</select></div>
    <div className="field"><label htmlFor="af_ch">Form type</label><select id="af_ch" value={v.channel} onChange={(e) => set('channel', e.target.value)}><option value="">Calls and emails</option><option>Call</option><option>Email</option></select></div>
  </div>;
}
