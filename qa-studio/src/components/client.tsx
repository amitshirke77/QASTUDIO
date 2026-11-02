'use client';
import { useEffect, useState, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

/* ---------- toasts ---------- */
export function toast(msg: string) { window.dispatchEvent(new CustomEvent('qa-toast', { detail: msg })); }
export function Toaster() {
  const [items, setItems] = useState<{ id: number; msg: string }[]>([]);
  useEffect(() => {
    const h = (e: Event) => { const id = Date.now() + Math.random(); setItems((x) => [...x, { id, msg: (e as CustomEvent).detail }]); setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3500); };
    window.addEventListener('qa-toast', h); return () => window.removeEventListener('qa-toast', h);
  }, []);
  return <div className="toast-host" role="status" aria-live="polite">{items.map((i) => <div key={i.id} className="toast">{i.msg}</div>)}</div>;
}

type R = { ok: true; data?: unknown } | { ok: false; error: string };
/** Runs a server action, shows errors, refreshes server data. */
export function useAction() {
  const router = useRouter(); const [pending, start] = useTransition(); const [error, setError] = useState('');
  const run = (fn: () => Promise<R>, opts: { success?: string; then?: (d: unknown) => void } = {}) => start(async () => {
    setError('');
    try { const r = await fn(); if (!r.ok) { setError(r.error); toast(r.error); return; } if (opts.success) toast(opts.success); opts.then?.(r.data); router.refresh(); }
    catch (e) { setError('Something went wrong. Please try again.'); console.error(e); }
  });
  return { run, pending, error, setError };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ActionButton({ action, args = [], label, success, className, confirm: c, disabled }: { action: (...a: any[]) => Promise<R>; args?: unknown[]; label: string; success?: string; className?: string; confirm?: string; disabled?: boolean }) {
  const { run, pending } = useAction();
  return <button className={'btn ' + (className || '')} disabled={pending || disabled} onClick={() => { if (c && !window.confirm(c)) return; run(() => action(...args), { success }); }}>{pending ? 'Working…' : label}</button>;
}

/* ---------- URL-driven filters ---------- */
export type Opt = [string, string];
export function FilterBar({ agents, auditors, customers, weeks, hideAgent, extra, from, to, clients = [], lobs = ['Tripstacc', 'Shopstacc'] }: { clients?: Opt[]; lobs?: string[]; agents: Opt[]; auditors: Opt[]; customers: string[]; weeks: Opt[]; hideAgent?: boolean; extra?: React.ReactNode; from?: string; to?: string }) {
  const router = useRouter(), path = usePathname(), sp = useSearchParams();
  const v = (k: string) => sp.get(k) || '';
  const set = (k: string, val: string) => { const n = new URLSearchParams(sp.toString()); if (val) n.set(k, val); else n.delete(k); if (k === 'from' || k === 'to') n.delete('we'); router.push(`${path}?${n.toString()}`); };
  const S = ({ id, k, opts, all }: { id: string; k: string; opts: Opt[]; all: string }) => <select id={id} value={v(k)} onChange={(e) => set(k, e.target.value)}><option value="">{all}</option>{opts.map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select>;
  return (
    <div className="filters card" style={{ padding: 12 }}>
      <div className="field"><label htmlFor="f_by">Date basis</label><select id="f_by" value={v('by') || 'audit'} onChange={(e) => set('by', e.target.value === 'audit' ? '' : e.target.value)}><option value="audit">Audit date</option><option value="call">Call / email date</option></select></div>
      <div className="field"><label htmlFor="f_from">From</label><input type="date" id="f_from" key={'f' + (from || '')} defaultValue={v('from') || from} onChange={(e) => e.target.value && set('from', e.target.value)} /></div>
      <div className="field"><label htmlFor="f_to">To</label><input type="date" id="f_to" key={'t' + (to || '')} defaultValue={v('to') || to} onChange={(e) => e.target.value && set('to', e.target.value)} /></div>
      <div className="field"><label htmlFor="f_we">Week ending</label><S id="f_we" k="we" opts={weeks} all="All weeks" /></div>
      {clients.length > 1 && <div className="field"><label htmlFor="f_client">Client</label><S id="f_client" k="cl" opts={clients} all="All clients" /></div>}
      <div className="field"><label htmlFor="f_customer">Customer</label><S id="f_customer" k="customer" opts={customers.map((c) => [c, c])} all="All customers" /></div>
      {!hideAgent && <div className="field"><label htmlFor="f_agent">Agent</label><S id="f_agent" k="agent" opts={agents} all="All agents" /></div>}
      <div className="field"><label htmlFor="f_auditor">Auditor</label><S id="f_auditor" k="auditor" opts={auditors} all="All auditors" /></div>
      <div className="field"><label htmlFor="f_lob">LOB</label><S id="f_lob" k="lob" opts={lobs.map((l) => [l, l])} all="All LOBs" /></div>
      <div className="field"><label htmlFor="f_ch">Form type</label><S id="f_ch" k="channel" opts={[['Call', 'Call'], ['Email', 'Email']]} all="Calls and emails" /></div>
      {extra}
    </div>
  );
}
export function Seg({ k, opts, def }: { k: string; opts: Opt[]; def: string }) {
  const router = useRouter(), path = usePathname(), sp = useSearchParams(); const cur = sp.get(k) || def;
  return <div className="seg-sm" role="group">{opts.map(([a, b]) => <button key={a} className={cur === a ? 'on' : ''} onClick={() => { const n = new URLSearchParams(sp.toString()); if (a === def) n.delete(k); else n.set(k, a); router.push(`${path}?${n}`); }}>{b}</button>)}</div>;
}
export function Modal({ title, onClose, children, foot }: { title: string; onClose: () => void; children: React.ReactNode; foot?: React.ReactNode }) {
  useEffect(() => { const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);
  return <div className="modal-back" onClick={(e) => e.target === e.currentTarget && onClose()}><div className="modal-box" role="dialog" aria-modal="true" aria-label={title}><h2>{title}</h2>{children}{foot && <div className="actions" style={{ justifyContent: 'flex-end' }}>{foot}</div>}</div></div>;
}
