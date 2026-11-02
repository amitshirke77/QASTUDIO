'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { scoreOf } from '@/lib/scoring';
import { createAudit } from '@/app/actions/audits';
import { toast } from '@/components/client';

type P = { id: string; name: string; description: string; weight: number; fatal: boolean; options: string[]; guideY: string; guideN: string; guideNA: string };
type F = { id: string; name: string; version: number; channel: string; lobs: string[]; sections: { id: string; name: string; params: P[] }[] };
type Props = { me: { id: string; role: string }; agents: { id: string; name: string; lob: string; tlId: string; clientId: string }[]; qas: { id: string; name: string }[]; tls: { id: string; name: string }[]; forms: F[]; customers: string[]; customersByClient: Record<string, string[]>; products: Record<string, string[]>; aoiForN: boolean; alloc: { id: string; agentId: string; channel: string } | null;
  fit: { period: string; lines: Record<string, { plan: number; done: number }>; agents: Record<string, { pc: number; pe: number; dc: number; de: number }>; top: { agentId: string; agentName: string; customer: string; product: string; channel: string }[] } | null;
  prefill: { agentId: string; customer: string; product: string; channel?: string } | null };
const pctS = (v: number | null) => (v == null ? '—' : v.toFixed(1) + '%');
const scls = (v: number | null) => (v == null ? '' : v >= 90 ? 's-good' : v >= 80 ? 's-warn' : 's-bad');
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60e3).toISOString().slice(0, 10);

export default function AuditForm(p: Props) {
  const router = useRouter();
  const KEY = `qa-draft-${p.me.id}`;
  const ag0 = p.alloc ? p.agents.find((a) => a.id === p.alloc!.agentId) : p.prefill ? p.agents.find((a) => a.id === p.prefill!.agentId) : undefined;
  const init = () => ({ channel: p.alloc?.channel || p.prefill?.channel || 'Call', agentId: ag0?.id || '', lob: ag0?.lob || 'Tripstacc', product: p.prefill && (p.products[ag0?.lob || ''] || []).includes(p.prefill.product) ? p.prefill.product : '', customer: p.prefill?.customer || '', caseId: '', auditDate: today(), interactionDate: '', phone: '', link: '', auditorId: p.qas.some((q) => q.id === p.me.id) ? p.me.id : '', tlId: ag0?.tlId || (p.me.role === 'tl' ? p.me.id : ''), answers: {} as Record<string, string>, obs: '', aois: [] as { paramId: string | null; text: string }[], formId: '' });
  const [d, setD] = useState(init);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { if (p.alloc || p.prefill) return; try { const s = localStorage.getItem(KEY); if (s) { const v = JSON.parse(s); if (v && v.answers) setD((x) => ({ ...x, ...v })); } } catch { /* storage unavailable */ } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* ignore */ } }, [d, KEY]);
  const fs = p.forms.filter((f) => f.channel === d.channel && f.lobs.includes(d.lob));
  const form = fs.find((f) => f.id === d.formId) || fs[0];
  const sc = useMemo(() => (form ? scoreOf(form, d.answers) : null), [form, d.answers]);
  const set = (k: string, v: unknown) => setD((x) => ({ ...x, [k]: v }));
  if (!form || !sc) return <div className="card empty">No active {d.channel.toLowerCase()} form is mapped to {d.lob}.</div>;
  const params = form.sections.flatMap((s) => s.params);
  const ans = (pid: string, v: string) => setD((x) => ({ ...x, answers: { ...x.answers, [pid]: v }, aois: v === 'N' && !x.aois.some((a) => a.paramId === pid) ? [...x.aois, { paramId: pid, text: '' }] : x.aois }));
  const left = sc.count - sc.answered, compSt = !left ? 'done' : sc.answered ? 'part' : 'none';
  const nextUnrated = () => { const q = params.find((x) => !d.answers[x.id]); if (!q) return; const s = form.sections.find((s) => s.params.includes(q))!; setOpen((o) => ({ ...o, [s.id]: true })); setTimeout(() => document.getElementById('pr_' + q.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); };
  const submit = async () => {
    setErr(''); const miss: string[] = [];
    if (!d.agentId) miss.push('Agent'); if (!d.caseId.trim()) miss.push('Case ID'); if (!d.interactionDate) miss.push(d.channel === 'Call' ? 'Call date' : 'Email date'); if (!d.customer) miss.push('Customer'); if (!d.auditorId) miss.push('Name of QA'); if (!d.tlId) miss.push('Name of TL');
    if (left) miss.push(`${left} unrated parameters`);
    if (p.aoiForN) { const m = params.filter((x) => d.answers[x.id] === 'N' && !d.aois.some((a) => a.paramId === x.id && a.text.trim())); if (m.length) miss.push('an area of improvement for: ' + m.map((x) => x.name).join(', ')); }
    if (miss.length) { setErr('Complete before submitting: ' + miss.join('; ') + '.'); toast('Audit is incomplete.'); return; }
    setBusy(true);
    const r = await createAudit({ ...d, formId: form.id, observations: d.obs, product: d.product || (p.products[d.lob] || [])[0], answers: d.answers as Record<string, 'Y' | 'N' | 'NA'>, allocationId: p.alloc?.id || null });
    setBusy(false);
    if (!r.ok) { setErr(r.error); toast(r.error); return; }
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    toast('Audit submitted. The agent has been notified.'); router.push(`/audits/${(r.data as { id: string }).id}`);
  };
  const agentSel = (id: string) => { const a = p.agents.find((x) => x.id === id); setD((x) => ({ ...x, agentId: id, tlId: a?.tlId || x.tlId, lob: a?.lob || x.lob, product: a && a.lob !== x.lob ? '' : x.product, answers: a && a.lob !== x.lob ? {} : x.answers })); };
  return (
    <div className="audit-layout"><div className="stack" id="auditMain">
      <div className="seg-sm" role="group" aria-label="Form type">{['Call', 'Email'].map((c) => <button key={c} className={d.channel === c ? 'on' : ''} onClick={() => setD((x) => ({ ...x, channel: c, answers: {}, aois: [], formId: '' }))}>{c} form</button>)}</div>
      <section className="card"><h2 style={{ marginBottom: 12 }}>Interaction details</h2><div className="form-grid">
        <div className="field"><label htmlFor="d_agentId">Agent <span className="req">*</span></label><select id="d_agentId" value={d.agentId} onChange={(e) => agentSel(e.target.value)}><option value="">Select agent</option>{p.agents.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.lob}</option>)}</select></div>
        <div className="field"><label htmlFor="d_caseId">{d.channel === 'Call' ? 'Case ID' : 'Ticket / case ID'} <span className="req">*</span></label><input id="d_caseId" value={d.caseId} onChange={(e) => set('caseId', e.target.value)} placeholder="CC66120" /></div>
        <div className="field"><label htmlFor="d_auditDate">Audit date <span className="req">*</span></label><input type="date" id="d_auditDate" value={d.auditDate} max={today()} onChange={(e) => set('auditDate', e.target.value)} /></div>
        <div className="field"><label htmlFor="d_interactionDate">{d.channel === 'Call' ? 'Call date' : 'Email date'} <span className="req">*</span></label><input type="date" id="d_interactionDate" value={d.interactionDate} max={d.auditDate} onChange={(e) => set('interactionDate', e.target.value)} /></div>
        <div className="field"><label htmlFor="d_lob">LOB</label><input id="d_lob" readOnly value={d.lob} /></div>
        <div className="field"><label htmlFor="d_product">Product <span className="req">*</span></label><select id="d_product" value={d.product || (p.products[d.lob] || [])[0]} onChange={(e) => set('product', e.target.value)}>{(p.products[d.lob] || []).map((x) => <option key={x}>{x}</option>)}</select></div>
        <div className="field"><label htmlFor="d_customer">Customer <span className="req">*</span></label><select id="d_customer" value={d.customer} onChange={(e) => set('customer', e.target.value)}><option value="">Select customer</option>{((p.agents.find((a) => a.id === d.agentId)?.clientId && p.customersByClient[p.agents.find((a) => a.id === d.agentId)!.clientId]) || p.customers).map((c) => <option key={c}>{c}</option>)}</select></div>
        <div className="field"><label htmlFor="d_phone">Customer phone</label><input id="d_phone" inputMode="tel" value={d.phone} onChange={(e) => set('phone', e.target.value)} /></div>
        <div className="field span2"><label htmlFor="d_link">{d.channel === 'Call' ? 'Call recording link' : 'Email / ticket link'} (optional)</label><input type="url" id="d_link" value={d.link} onChange={(e) => set('link', e.target.value)} placeholder="https://…ozonetel.com/…mp3" /></div>
        <div className="field"><label htmlFor="d_auditorId">Name of QA <span className="req">*</span></label><select id="d_auditorId" value={d.auditorId} disabled={p.me.role === 'tl'} onChange={(e) => set('auditorId', e.target.value)}><option value="">Select QA</option>{p.qas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
        <div className="field"><label htmlFor="d_tlId">Name of TL <span className="req">*</span></label><select id="d_tlId" value={d.tlId} onChange={(e) => set('tlId', e.target.value)}><option value="">Select TL</option>{p.tls.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
        {fs.length > 1 && <div className="field span2"><label htmlFor="d_formId">Form</label><select id="d_formId" value={form.id} onChange={(e) => setD((x) => ({ ...x, formId: e.target.value, answers: {} }))}>{fs.map((x) => <option key={x.id} value={x.id}>{x.name} v{x.version}</option>)}</select></div>}
      </div></section>
      {form.sections.map((s, i) => { const ss = sc.sections[i]; const isOpen = open[s.id] !== false; return (
        <section key={s.id} className={'sec ' + (isOpen ? 'open' : '')} id={'sec_' + s.id}>
          <div className="sec-hd" onClick={() => setOpen((o) => ({ ...o, [s.id]: !isOpen }))}><span className="caret">▶</span><h3>{s.name}</h3><span className="meta">{ss.answered}/{ss.count} · {ss.score == null ? '—' : ss.score.toFixed(0) + '%'}{ss.fatal ? ' · fatal' : ''}</span>
            <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); setD((x) => ({ ...x, answers: { ...x.answers, ...Object.fromEntries(s.params.filter((q) => !x.answers[q.id]).map((q) => [q.id, 'Y'])) } })); }} title="Mark unrated parameters in this section Yes">All Y</button></div>
          <div className="sec-body">{s.params.map((q) => { const v = d.answers[q.id]; return (
            <div key={q.id} className={'prow ' + (v === 'N' ? 'isN' : '')} id={'pr_' + q.id}>
              <div className="pinfo"><div className="pname">{q.name}</div><div className="pdesc">{q.description}</div>
                {(q.guideY || q.guideN) && <details className="guide"><summary>How to rate</summary><div className="small"><b>Y</b> {q.guideY}<br /><b>N</b> {q.guideN}{q.guideNA && <><br /><b>NA</b> {q.guideNA}</>}</div></details>}</div>
              <div className="pmeta"><span className="wt" title="Weightage">{q.weight}</span>{q.fatal && <span className="chip bad">Fatal</span>}</div>
              <div className="seg" role="group" aria-label={q.name}>{q.options.map((o) => <button key={o} data-v={o} className={v === o ? 'on' : ''} aria-pressed={v === o} onClick={() => ans(q.id, o)}>{o}</button>)}</div>
            </div>); })}</div>
        </section>); })}
    </div>
    <aside className="score-pane" id="scorePane">
      <div className="pane-card stack" style={{ gap: 12 }}><div className="eyebrow">Assessment</div>
        <div className={'comp comp-' + compSt} role="status" aria-live="polite"><div className="comp-top"><span className="comp-ic"><svg viewBox="0 0 24 24" aria-hidden="true">{compSt === 'done' ? <path d="M5 12.5l4.2 4.2L19 7" /> : <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v5M12 16.2v.01" /></>}</svg></span>
          <div className="comp-txt"><b>{compSt === 'done' ? 'All parameters rated · ready to submit' : compSt === 'part' ? `${left} parameter${left === 1 ? '' : 's'} still to rate` : `Not started · ${sc.count} parameters to rate`}</b><span>{sc.answered} of {sc.count} rated</span></div><span className="comp-pct">{Math.round((sc.answered / sc.count) * 100)}%</span></div>
          <div className="comp-bar"><i style={{ width: (sc.answered / sc.count) * 100 + '%' }} /></div>{compSt !== 'done' && <button className="comp-go" onClick={nextUnrated}>Go to next unrated parameter →</button>}</div>
        <div className="big-scores"><div className="bs"><div className="l">Overall score</div><div className={'v ' + scls(sc.running)}>{pctS(sc.running)}</div></div><div className={'bs ' + (sc.fatal ? 'fatal' : '')}><div className="l">Actual quality</div><div className={'v ' + (sc.fatal ? '' : scls(sc.running))}>{pctS(sc.fatal ? 0 : sc.running)}</div></div></div>
        {sc.fatal && <div className="note" style={{ borderColor: 'var(--bad)', background: 'var(--bad-soft)' }}>A fatal parameter is marked No, so the Actual quality score is 0. The Overall score still counts every Yes and NA.</div>}
        <div>{sc.sections.map((s) => <div key={s.id} className="sec-line" onClick={() => document.getElementById('sec_' + s.id)?.scrollIntoView({ behavior: 'smooth' })}><span className="nm">{s.fatal ? '⚠ ' : ''}{s.name}</span><span className={'mono ' + (s.fatal ? 's-bad' : scls(s.score))}>{s.answered}/{s.count} · {s.score == null ? '—' : s.score.toFixed(0) + '%'}</span><div className="bar"><i style={{ width: (s.answered / s.count) * 100 + '%', background: s.fatal ? 'var(--bad)' : undefined }} /></div></div>)}</div>
      </div>
      {p.fit && (() => { const f = p.fit; const prod = d.product || (p.products[d.lob] || [])[0]; const lk = [d.customer, d.lob, prod, d.channel].join('|'); const ln = d.customer ? f.lines[lk] : undefined; const ag = d.agentId ? f.agents[d.agentId] : undefined;
        const agPlan = ag ? (d.channel === 'Call' ? ag.pc : ag.pe) : 0, agDone = ag ? (d.channel === 'Call' ? ag.dc : ag.de) : 0;
        const over = (ln && ln.plan > 0 && ln.done >= ln.plan) || (ag && agPlan > 0 && agDone >= agPlan); const offPlan = d.customer && !ln;
        return <div className={'pane-card stack'} style={{ gap: 6, borderColor: over || offPlan ? 'var(--warn)' : undefined }}><div className="eyebrow">Plan fit · {f.period}</div>
          {!d.agentId || !d.customer ? <span className="muted small">Pick the agent and customer to see how this audit fits your plan.</span> : <>
            <span className="small">{d.customer} · {prod} · {d.channel}s: <b>{ln ? `${ln.done} of ${Math.round(ln.plan * 10) / 10}` : 'not in your plan'}</b></span>
            <span className="small">{p.agents.find((a) => a.id === d.agentId)?.name} {d.channel.toLowerCase()}s: <b>{ag ? `${agDone} of ${Math.round(agPlan * 10) / 10}` : 'no share of your plan'}</b></span>
            {(over || offPlan) && <span className="small" style={{ color: 'var(--warn)' }}>{offPlan ? 'This line is not in your plan.' : 'Already at or above plan.'}{f.top[0] ? ` Next in your plan: ${f.top[0].agentName} · ${f.top[0].customer} · ${f.top[0].product} · ${f.top[0].channel}.` : ''}</span>}</>}
          <a className="rel-link small" href="/plan">Open my plan</a></div>; })()}
      <div className="pane-card obs-card"><div className="obs-hd"><label htmlFor="d_obs" className="eyebrow">{d.channel} observations</label><span className="muted small">{d.obs.trim() ? d.obs.trim().split(/\s+/).length + ' words' : ''}</span></div>
        <textarea id="d_obs" rows={5} value={d.obs} onChange={(e) => set('obs', e.target.value)} placeholder="What the customer wanted, what the agent did, and the outcome" /></div>
      <div className="pane-card aoi-card" id="findings"><div className="obs-hd"><span className="eyebrow">{d.channel} findings · areas of improvement</span></div>
        <div className="stack" style={{ gap: 8 }}>{d.aois.map((a, i) => <div key={i} className="aoi-row" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', gap: 6 }}><select aria-label="Parameter" value={a.paramId || ''} onChange={(e) => setD((x) => ({ ...x, aois: x.aois.map((y, j) => (j === i ? { ...y, paramId: e.target.value || null } : y)) }))} style={{ flex: 1 }}><option value="">General</option>{params.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}</select><button className="btn ghost sm" aria-label="Remove" onClick={() => setD((x) => ({ ...x, aois: x.aois.filter((_, j) => j !== i) }))}>✕</button></div>
          <textarea rows={2} aria-label="Area of improvement" value={a.text} placeholder="What the agent should do differently" onChange={(e) => setD((x) => ({ ...x, aois: x.aois.map((y, j) => (j === i ? { ...y, text: e.target.value } : y)) }))} /></div>)}
          <button className="btn sm" onClick={() => setD((x) => ({ ...x, aois: [...x.aois, { paramId: null, text: '' }] }))} style={{ alignSelf: 'flex-start' }}>Add area of improvement</button>
          <span className="muted small">A “No” rating adds a row for that parameter automatically.</span></div></div>
      <div className="pane-card stack" style={{ gap: 8, position: 'sticky', bottom: 0 }}><div className="err" id="subErr" role="alert">{err}</div>
        <button className="btn primary" disabled={busy} onClick={submit} style={{ justifyContent: 'center' }}>{busy ? 'Submitting…' : 'Submit audit and notify agent'}</button>
        <button className="btn ghost sm" onClick={() => { if (window.confirm('Clear this audit?')) setD(init()); }}>Clear form</button></div>
    </aside></div>
  );
}
