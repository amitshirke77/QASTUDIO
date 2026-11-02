'use client';
import { useMemo, useState } from 'react';
import { scoreOf } from '@/lib/scoring';
import { submitCalibScore, setAgreed, closeCalibration } from '@/app/actions/calibration';
import { useAction } from '@/components/client';
type F = { sections: { id: string; name: string; params: { id: string; name: string; weight: number; fatal: boolean; options: string[]; guideY: string; guideN: string; guideNA: string }[] }[] };
export function ScoreForm({ sessionId, form, items }: { sessionId: string; form: F; items: { id: string; caseId: string; link: string | null }[] }) {
  const it = items[0]; const [ans, setAns] = useState<Record<string, string>>({}), [note, setNote] = useState(''); const { run, pending, error } = useAction();
  const sc = useMemo(() => scoreOf(form, ans), [form, ans]); const left = sc.count - sc.answered;
  return (<div className="audit-layout" key={it.id}><div className="stack">
    <div className="card"><div className="eyebrow">Interaction {items.length > 1 ? `· ${items.length} left` : '· last one'}</div><h2>{it.caseId}</h2>{it.link && <a className="rel-link" href={it.link} target="_blank" rel="noreferrer">Open recording</a>}<p className="muted small">Score it as you would a normal audit. Other auditors&apos; ratings stay hidden until you have scored every interaction.</p></div>
    {form.sections.map((s) => <section key={s.id} className="sec open"><div className="sec-hd"><h3>{s.name}</h3></div><div className="sec-body">{s.params.map((p) => <div key={p.id} className={'prow ' + (ans[p.id] === 'N' ? 'isN' : '')}><div className="pinfo"><div className="pname">{p.name}</div>{p.guideY && <details className="guide"><summary>How to rate</summary><div className="small"><b>Y</b> {p.guideY}<br /><b>N</b> {p.guideN}{p.guideNA && <><br /><b>NA</b> {p.guideNA}</>}</div></details>}</div><div className="pmeta"><span className="wt">{p.weight}</span>{p.fatal && <span className="chip bad">Fatal</span>}</div><div className="seg">{p.options.map((o) => <button key={o} data-v={o} className={ans[p.id] === o ? 'on' : ''} onClick={() => setAns({ ...ans, [p.id]: o })}>{o}</button>)}</div></div>)}</div></section>)}
  </div><aside className="score-pane"><div className="pane-card stack" style={{ gap: 10 }}><div className={'comp comp-' + (!left ? 'done' : sc.answered ? 'part' : 'none')}><div className="comp-top"><div className="comp-txt"><b>{left ? `${left} parameters still to rate` : 'All rated · ready to submit'}</b><span>{sc.answered} of {sc.count}</span></div></div><div className="comp-bar"><i style={{ width: (sc.answered / sc.count) * 100 + '%' }} /></div></div>
    <div className="big-scores"><div className="bs"><div className="l">Overall</div><div className="v">{sc.running == null ? '—' : sc.running.toFixed(1) + '%'}</div></div><div className={'bs ' + (sc.fatal ? 'fatal' : '')}><div className="l">Actual</div><div className="v">{sc.running == null ? '—' : (sc.fatal ? 0 : sc.running).toFixed(1) + '%'}</div></div></div>
    <div className="field"><label htmlFor="cn">Note (optional)</label><textarea id="cn" rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></div>
    <div className="err" role="alert">{error}</div><button className="btn primary" disabled={pending || left > 0} onClick={() => run(() => submitCalibScore(sessionId, it.id, ans as Record<string, 'Y'>, note), { success: 'Score submitted', then: () => { setAns({}); setNote(''); window.scrollTo(0, 0); } })}>Submit score</button></div></aside></div>);
}
export function AgreeSelect({ sessionId, itemId, paramId, value, mode }: { sessionId: string; itemId: string; paramId: string; value: string; mode: string }) {
  const { run, pending } = useAction();
  return <select aria-label="Agreed rating" disabled={pending} value={value} onChange={(e) => run(() => setAgreed(sessionId, itemId, paramId, e.target.value, ''))}><option value="">{mode ? `Most common (${mode})` : '—'}</option><option>Y</option><option>N</option><option>NA</option></select>;
}
export function CloseForm({ sessionId }: { sessionId: string }) {
  const [o, setO] = useState(''); const { run, pending, error } = useAction();
  return <div className="card stack"><h3>Close the session</h3><p className="muted small" style={{ margin: 0 }}>Parameters without an agreed rating take the most common one. Each participant is notified with their agreement %.</p>
    <div className="field"><label htmlFor="co">Outcome for the team</label><textarea id="co" rows={3} value={o} onChange={(e) => setO(e.target.value)} placeholder="What we agreed, and any guideline changes" /></div><div className="err">{error}</div>
    <div className="actions"><button className="btn primary" disabled={pending} onClick={() => window.confirm('Close this session?') && run(() => closeCalibration(sessionId, o), { success: 'Session closed' })}>Close session</button></div></div>;
}
