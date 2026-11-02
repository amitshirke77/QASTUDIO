'use client';
import type { Quiz } from '@/db/schema';
type Res = Record<string, { label: string; feedback?: string }>;
/** MS Forms-style rendering of a quiz, used for taking, previewing and reviewing results. */
export default function QuizForm({ qz, ans, setAns, result, preview }: { qz: Quiz; ans: Record<string, unknown>; setAns?: (a: Record<string, unknown>) => void; result?: Res; preview?: boolean }) {
  const ro = !!result || !setAns; const set = (k: string, v: unknown) => setAns?.({ ...ans, [k]: v });
  return (<div className="qz-form">
    {qz.questions.map((q, i) => { const v = ans[q.id]; const r = result?.[q.id]; const show = !!result && qz.showAnswers;
      return <div key={q.id} className="qz-q" id={'qq_' + q.id}><div className="qz-q-hd"><span>{i + 1}. {q.text || 'Untitled question'}{q.required && <span className="req" style={{ color: 'var(--bad)' }}> *</span>}</span>{q.type !== 'rating' && q.points > 0 && <span className="muted small">{r ? r.label : `${q.points} point${q.points === 1 ? '' : 's'}`}</span>}</div>
        {(q.type === 'single' || q.type === 'tf') && q.options.map((o) => <label key={o.id} className={'qz-choice ' + (show && o.correct ? 'ok' : '') + (result && v === o.id && !o.correct ? ' bad' : '')}><input type="radio" name={'qa_' + q.id} checked={v === o.id} disabled={ro} onChange={() => set(q.id, o.id)} /> {o.text || 'Option'}</label>)}
        {q.type === 'multi' && q.options.map((o) => { const arr = (v as string[]) || []; return <label key={o.id} className={'qz-choice ' + (show && o.correct ? 'ok' : '') + (result && arr.includes(o.id) && !o.correct ? ' bad' : '')}><input type="checkbox" checked={arr.includes(o.id)} disabled={ro} onChange={(e) => set(q.id, e.target.checked ? [...arr, o.id] : arr.filter((x) => x !== o.id))} /> {o.text || 'Option'}</label>; })}
        {q.type === 'short' && <input type="text" aria-label="Your answer" value={String(v ?? '')} disabled={ro} placeholder="Your answer" onChange={(e) => set(q.id, e.target.value)} />}
        {q.type === 'long' && <textarea aria-label="Your answer" rows={4} value={String(v ?? '')} disabled={ro} placeholder="Your answer" onChange={(e) => set(q.id, e.target.value)} />}
        {q.type === 'rating' && <div className="qz-rate">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" className={'qz-star ' + ((+(v as number) || 0) >= n ? 'on' : '')} disabled={ro} aria-label={`${n} of 5`} onClick={() => set(q.id, n)}>★</button>)}</div>}
        {r?.feedback && <div className="note small" style={{ marginTop: 8 }}>{r.feedback}</div>}
      </div>; })}
    {preview && <p className="muted small" style={{ margin: 0 }}>Preview only. Answers are not saved.</p>}
  </div>);
}
