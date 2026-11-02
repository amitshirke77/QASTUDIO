'use client';
import { useState } from 'react';
import type { Quiz, QuizQuestion } from '@/db/schema';
import { QT, QT_HINT, newQuestion, quizMax } from '@/lib/quiz';
import { suggestQuiz } from '@/app/actions/learning';
import { toast } from '@/components/client';
import QuizForm from './QuizForm';

export default function QuizBuilder({ quiz, setQuiz, params }: { quiz: Quiz | null; setQuiz: (q: Quiz | null) => void; params: string[] }) {
  const [preview, setPreview] = useState(false); const [busy, setBusy] = useState(false);
  if (!quiz) return <section className="card stack"><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}><div><h2>Quiz (optional)</h2><p className="muted small" style={{ margin: '4px 0 0' }}>Add a short quiz agents take after accepting. Objective questions score themselves from your answer key; written answers are graded by you.</p></div><button className="btn" onClick={() => setQuiz({ enabled: true, passPct: 70, attempts: 2, showAnswers: true, questions: [newQuestion('single')] })}>Add a quiz</button></div></section>;
  const qs = quiz.questions; const upd = (i: number, q: Partial<QuizQuestion>) => setQuiz({ ...quiz, questions: qs.map((x, j) => (j === i ? { ...x, ...q } : x)) });
  const move = (i: number, d: number) => { const n = qs.slice(); const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; setQuiz({ ...quiz, questions: n }); };
  const suggest = async () => { setBusy(true); const add = await suggestQuiz(params); setBusy(false); const keep = qs.length === 1 && !qs[0].text.trim() ? [] : qs; setQuiz({ ...quiz, questions: [...keep, ...add] }); setPreview(false); toast(`Added ${add.length} suggested questions. Review the wording and answer key before publishing.`); };
  const max = quizMax(quiz);
  return (<section className="card stack qz-builder">
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><div><h2>Quiz</h2><p className="muted small" style={{ margin: '4px 0 0' }}>{qs.length} question{qs.length === 1 ? '' : 's'} · {max} point{max === 1 ? '' : 's'} · agents take it after accepting.</p></div>
      <div className="actions"><button className="btn sm" disabled={!params.length || busy} title={params.length ? '' : 'Tick linked parameters first'} onClick={suggest}>{busy ? 'Thinking…' : 'Suggest questions from linked parameters'}</button><button className="btn sm" onClick={() => setPreview(!preview)}>{preview ? 'Back to editing' : 'Preview as agent'}</button><button className="btn ghost sm" onClick={() => setQuiz(null)}>Remove quiz</button></div></div>
    <div className="form-grid"><div className="field"><label htmlFor="qz_pass">Pass mark (%)</label><input id="qz_pass" type="number" min={0} max={100} value={quiz.passPct} onChange={(e) => setQuiz({ ...quiz, passPct: Math.max(0, Math.min(100, +e.target.value || 0)) })} /></div>
      <div className="field"><label htmlFor="qz_att">Attempts allowed</label><input id="qz_att" type="number" min={1} max={5} value={quiz.attempts} onChange={(e) => setQuiz({ ...quiz, attempts: Math.max(1, Math.min(5, +e.target.value || 1)) })} /></div>
      <div className="field span2"><label>After submitting</label><label className="check small"><input type="checkbox" checked={quiz.showAnswers} onChange={(e) => setQuiz({ ...quiz, showAnswers: e.target.checked })} /> Show agents the correct answers</label></div></div>
    {preview ? <QuizForm qz={quiz} ans={{}} preview /> : <>
      <div className="stack" style={{ gap: 10 }}>{qs.map((q, i) => { const opts = q.type === 'single' || q.type === 'multi' || q.type === 'tf';
        return <div key={q.id} className="qz-card"><div className="qz-card-hd"><span className="qz-n">{i + 1}</span><span className="chip">{QT[q.type]}</span><span className="muted small" style={{ flex: 1 }}>{QT_HINT[q.type]}</span>
          <button className="btn ghost sm" disabled={!i} aria-label="Move up" onClick={() => move(i, -1)}>↑</button><button className="btn ghost sm" disabled={i === qs.length - 1} aria-label="Move down" onClick={() => move(i, 1)}>↓</button>
          <button className="btn ghost sm" onClick={() => { const c: QuizQuestion = JSON.parse(JSON.stringify(q)); c.id = newQuestion(q.type).id; c.options = c.options.map((o) => ({ ...o, id: newQuestion('tf').options[0].id + Math.random().toString(36).slice(2, 5) })); const n = qs.slice(); n.splice(i + 1, 0, c); setQuiz({ ...quiz, questions: n }); }}>Duplicate</button>
          <button className="btn ghost sm" aria-label="Delete question" onClick={() => setQuiz({ ...quiz, questions: qs.filter((_, j) => j !== i) })}>✕</button></div>
          <textarea aria-label={`Question ${i + 1}`} rows={2} placeholder="Question" value={q.text} onChange={(e) => upd(i, { text: e.target.value })} />
          {opts && <div className="qz-opts">{q.options.map((o, oi) => <div key={o.id} className="qz-opt">
            <button className={'qz-mark ' + (q.type === 'multi' ? 'sq ' : '') + (o.correct ? 'on' : '')} aria-pressed={o.correct} title="Mark as correct" onClick={() => upd(i, { options: q.options.map((x, k) => (q.type === 'multi' ? (k === oi ? { ...x, correct: !x.correct } : x) : { ...x, correct: k === oi })) })}>{o.correct ? '✓' : ''}</button>
            {q.type === 'tf' ? <span>{o.text}</span> : <><input aria-label={`Option ${oi + 1}`} value={o.text} placeholder={`Option ${oi + 1}`} onChange={(e) => upd(i, { options: q.options.map((x, k) => (k === oi ? { ...x, text: e.target.value } : x)) })} /><button className="btn ghost sm" disabled={q.options.length <= 2} aria-label="Remove option" onClick={() => { const n = q.options.filter((_, k) => k !== oi); if (q.type === 'single' && !n.some((x) => x.correct)) n[0].correct = true; upd(i, { options: n }); }}>✕</button></>}</div>)}
            {q.type !== 'tf' && q.options.length < 10 && <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => upd(i, { options: [...q.options, { id: newQuestion('tf').options[1].id + oi(i), text: '', correct: false }] })}>Add option</button>}
            <span className="muted small">Tick the correct answer{q.type === 'multi' ? 's' : ''}.</span></div>}
          {q.type === 'short' && <div className="field"><label>Accepted answers (one per line, not case-sensitive). Leave blank to grade every answer manually.</label><textarea rows={2} value={q.accepted || ''} onChange={(e) => upd(i, { accepted: e.target.value })} /></div>}
          {q.type === 'long' && <p className="muted small" style={{ margin: 0 }}>Answers wait in the grading queue until you score them.</p>}
          {q.type === 'rating' && <div className="qz-stars" aria-hidden="true">★★★★★</div>}
          <div className="qz-foot">{q.type !== 'rating' ? <label className="small">Points <input type="number" min={0} max={50} value={q.points} style={{ width: 70 }} onChange={(e) => upd(i, { points: Math.max(0, +e.target.value || 0) })} /></label> : <span className="muted small">Not scored</span>}<label className="check small"><input type="checkbox" checked={q.required} onChange={(e) => upd(i, { required: e.target.checked })} /> Required</label></div></div>; })}</div>
      <div className="qz-add"><span className="muted small">Add question</span>{(Object.keys(QT) as QuizQuestion['type'][]).map((k) => <button key={k} className="btn sm" onClick={() => setQuiz({ ...quiz, questions: [...qs, newQuestion(k)] })}>{QT[k]}</button>)}</div>
    </>}
  </section>);
}
const oi = (i: number) => String(i) + Math.random().toString(36).slice(2, 6);
