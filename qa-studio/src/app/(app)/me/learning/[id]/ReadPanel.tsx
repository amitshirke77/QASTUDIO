'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { Quiz } from '@/db/schema';
import type { QuizState } from '@/lib/quiz';
import { acceptLearning, submitQuiz } from '@/app/actions/learning';
import { useAction } from '@/components/client';
import QuizForm from '@/components/quiz/QuizForm';
type Last = { status: string; score: number; max: number; pct: number | null; passed: boolean | null; answers: Record<string, unknown> } | null;
export default function ReadPanel({ itemId, body, params, accepted, comment, isJit, quiz, state, last, result, startQuiz }: { itemId: string; body: string; params: string[]; accepted: string | null; comment: string; isJit: boolean; quiz: Quiz | null; state: QuizState | null; last: Last; result?: Record<string, { label: string; feedback?: string }>; startQuiz: boolean }) {
  const [ok, setOk] = useState(false), [c, setC] = useState(''), [taking, setTaking] = useState(startQuiz && !!state && ['todo', 'retry'].includes(state.state)), [ans, setAns] = useState<Record<string, unknown>>({});
  const { run, pending, error } = useAction();
  if (taking && quiz) return (<div className="card stack"><div><h2>{quiz.questions.length} question{quiz.questions.length === 1 ? '' : 's'}</h2><p className="muted small" style={{ margin: '4px 0 0' }}>Pass mark {quiz.passPct}% · {state?.left} attempt{state?.left === 1 ? '' : 's'} left. Questions marked * are required.</p></div>
    <QuizForm qz={quiz} ans={ans} setAns={setAns} />
    <div className="err" id="qzErr" role="alert">{error}</div>
    <div className="actions"><button className="btn" onClick={() => setTaking(false)}>Back to training</button><button className="btn primary" disabled={pending} onClick={() => run(() => submitQuiz(itemId, ans), { then: (d) => { const r = d as { status: string; pct: number | null; passed: boolean }; setTaking(false); window.scrollTo(0, 0); window.dispatchEvent(new CustomEvent('qa-toast', { detail: r.status === 'Scored' ? `${r.passed ? 'Passed' : 'Score'}: ${r.pct?.toFixed(1)}%` : 'Submitted. Waiting for grading.' })); } })}>Submit answers</button></div></div>);
  return (<div className="audit-layout"><div className="stack">
    <div className="card stack"><div className="lrn-body" style={{ whiteSpace: 'pre-line' }}>{body}</div>{params.length > 0 && <div><div className="eyebrow">Related evaluation parameters</div><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>{params.map((p) => <span key={p} className="tag-param">{p}</span>)}</div><Link className="rel-link small" href="/legend">See how these are rated in the Evaluation legend</Link></div>}</div>
    {last && quiz && !taking && <div className="card stack"><h3>{last.status !== 'Scored' ? 'Quiz submitted, waiting for grading' : last.passed ? 'You passed the quiz' : 'Quiz not passed this time'}</h3><p className="muted small" style={{ margin: 0 }}>{last.status === 'Scored' ? `Score ${last.score} of ${last.max} (${last.pct?.toFixed(1)}%) · pass mark ${quiz.passPct}%` : 'Your auditor will grade the written answers. You will be notified.'}</p><QuizForm qz={quiz} ans={last.answers} result={result} /></div>}
  </div>
  <aside className="score-pane"><div className="pane-card stack" style={{ gap: 12 }}>
    {accepted ? <><div className="comp comp-done"><div className="comp-top"><div className="comp-txt"><b>Accepted</b><span>{new Date(accepted).toLocaleString()}</span></div></div></div>{comment && <p className="small" style={{ margin: 0 }}><b>Your comment:</b> {comment}</p>}</>
      : <><div className="eyebrow">Your confirmation</div><label className="check"><input type="checkbox" id="lr_ok" checked={ok} onChange={(e) => setOk(e.target.checked)} /> I have read and understood this {isJit ? 'training' : 'briefing note'} and will apply it.</label>
        <div className="field"><label htmlFor="lr_c">Question or comment (optional)</label><textarea id="lr_c" value={c} onChange={(e) => setC(e.target.value)} placeholder="Anything unclear? Your auditor will see this." /></div><div className="err" role="alert">{error}</div>
        <button className="btn primary" disabled={pending} onClick={() => run(() => acceptLearning(itemId, ok, c), { success: 'Accepted' })} style={{ justifyContent: 'center' }}>Accept</button></>}
  </div>
  {quiz && state && <div className="pane-card stack" style={{ gap: 10 }}><div className="eyebrow">Quiz</div><div><b>{quiz.questions.length} questions</b> · pass mark {quiz.passPct}%</div>
    {state.state === 'locked' ? <p className="muted small" style={{ margin: 0 }}>Accept the training to unlock the quiz.</p> : state.state === 'todo' || state.state === 'retry' ? <><span className={'chip ' + (state.state === 'retry' ? 'bad' : 'warn')} style={{ alignSelf: 'flex-start' }}>{state.label}</span><button className="btn primary" onClick={() => { setAns({}); setTaking(true); }} style={{ justifyContent: 'center' }}>{state.state === 'retry' ? 'Try again' : 'Start quiz'}</button></> : <span className={'chip ' + (state.state === 'passed' ? 'good' : state.state === 'grading' ? 'warn' : 'bad')} style={{ alignSelf: 'flex-start' }}>{state.label}</span>}
  </div>}</aside></div>);
}
