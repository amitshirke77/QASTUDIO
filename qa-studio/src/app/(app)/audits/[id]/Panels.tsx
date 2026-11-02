'use client';
import { useState } from 'react';
import { acknowledge, raiseDispute, resolveDispute, logFeedback, sendReminder } from '@/app/actions/audits';
import { useAction } from '@/components/client';
type PI = { id: string; name: string; options: string[]; value?: string };

export function AgentPanel({ auditId, status, params, outcome, note }: { auditId: string; status: string; params: PI[]; outcome: string; note: string }) {
  const { run, pending, error } = useAction();
  const [sug, setSug] = useState(''), [mode, setMode] = useState<'ack' | 'dispute'>('ack'), [ps, setPs] = useState<string[]>([]), [why, setWhy] = useState('');
  if (status === 'Acknowledged') return <div className="pane-card"><div className="comp comp-done"><div className="comp-txt"><b>You acknowledged this audit</b></div></div></div>;
  if (status === 'Disputed') return <div className="pane-card"><div className="note">Your dispute is with the auditor. You will be notified of the outcome.</div></div>;
  return (
    <div className="pane-card stack" style={{ gap: 10 }}><div className="eyebrow">Your response</div>
      {status === 'Dispute resolved' && <div className="note">Dispute {outcome.toLowerCase()}: {note}</div>}
      {status === 'Pending acknowledgement' && <div className="seg-sm"><button className={mode === 'ack' ? 'on' : ''} onClick={() => setMode('ack')}>Acknowledge</button><button className={mode === 'dispute' ? 'on' : ''} onClick={() => setMode('dispute')}>Dispute</button></div>}
      {mode === 'ack' ? <>
        <div className="field"><label htmlFor="ack_s">Suggestion (optional)</label><textarea id="ack_s" rows={2} value={sug} onChange={(e) => setSug(e.target.value)} /></div>
        <button className="btn primary" disabled={pending} onClick={() => run(() => acknowledge(auditId, sug), { success: 'Acknowledged' })}>Acknowledge feedback</button>
      </> : <>
        <div className="stack" style={{ gap: 4, maxHeight: 220, overflow: 'auto' }}>{params.map((p) => <label key={p.id} className="check small"><input type="checkbox" checked={ps.includes(p.id)} onChange={(e) => setPs(e.target.checked ? [...ps, p.id] : ps.filter((x) => x !== p.id))} /> {p.name} <span className={'chip ' + (p.value === 'N' ? 'bad' : '')}>{p.value}</span></label>)}</div>
        <div className="field"><label htmlFor="dp_r">Why you disagree</label><textarea id="dp_r" rows={3} value={why} onChange={(e) => setWhy(e.target.value)} /></div>
        <button className="btn primary" disabled={pending} onClick={() => run(() => raiseDispute(auditId, ps, why), { success: 'Dispute raised' })}>Raise dispute</button>
      </>}
      <div className="err" role="alert">{error}</div>
    </div>
  );
}

export function ResolvePanel({ auditId, reason, params }: { auditId: string; reason: string; params: PI[] }) {
  const { run, pending, error } = useAction();
  const [o, setO] = useState<'Upheld' | 'Rejected' | 'Partially upheld' | ''>(''), [n, setN] = useState(''), [rev, setRev] = useState<Record<string, 'Y' | 'N' | 'NA'>>({});
  return (
    <div className="pane-card stack" style={{ gap: 10 }}><div className="eyebrow">Resolve dispute</div><div className="note small">{reason}</div>
      <div className="field"><label htmlFor="rs_o">Outcome</label><select id="rs_o" value={o} onChange={(e) => setO(e.target.value as typeof o)}><option value="">Select</option><option>Upheld</option><option>Partially upheld</option><option>Rejected</option></select></div>
      {o && o !== 'Rejected' && params.map((p) => <div key={p.id} className="field"><label>{p.name} (was {p.value})</label><div className="seg">{p.options.map((x) => <button key={x} data-v={x} className={(rev[p.id] || p.value) === x ? 'on' : ''} onClick={() => setRev({ ...rev, [p.id]: x as 'Y' })}>{x}</button>)}</div></div>)}
      <div className="field"><label htmlFor="rs_n">Note to the agent</label><textarea id="rs_n" rows={3} value={n} onChange={(e) => setN(e.target.value)} /></div>
      <button className="btn primary" disabled={pending || !o} onClick={() => o && run(() => resolveDispute(auditId, o, n, rev), { success: 'Dispute resolved' })}>Save outcome and notify agent</button>
      <div className="err" role="alert">{error}</div>
    </div>
  );
}

export function StaffPanel({ auditId, canLog }: { auditId: string; canLog: boolean }) {
  const { run, pending, error } = useAction();
  const [m, setM] = useState('One-to-one'), [n, setN] = useState('');
  return (
    <div className="pane-card stack" style={{ gap: 10 }}><div className="eyebrow">Feedback</div>
      {canLog && <><div className="field"><label htmlFor="fb_m">How it was given</label><select id="fb_m" value={m} onChange={(e) => setM(e.target.value)}>{['One-to-one', 'Teams call', 'Huddle', 'Floor'].map((x) => <option key={x}>{x}</option>)}</select></div>
        <div className="field"><label htmlFor="fb_n">Note</label><textarea id="fb_n" rows={2} value={n} onChange={(e) => setN(e.target.value)} /></div>
        <button className="btn" disabled={pending} onClick={() => run(() => logFeedback(auditId, m, n), { success: 'Feedback session logged' })}>Log feedback session</button></>}
      <button className="btn ghost sm" disabled={pending} onClick={() => run(() => sendReminder(auditId), { success: 'Reminder sent' })}>Send reminder</button>
      <div className="err" role="alert">{error}</div>
    </div>
  );
}
