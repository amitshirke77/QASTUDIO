'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Quiz } from '@/db/schema';
import { QT, isScored } from '@/lib/quiz';
import { gradeSubmission } from '@/app/actions/learning';
import { useAction } from '@/components/client';
export default function GradeForm({ subId, itemId, quiz, answers, auto, manual }: { subId: string; itemId: string; quiz: Quiz; answers: Record<string, unknown>; auto: Record<string, number | null>; manual: Record<string, { points: number | null; feedback: string }> }) {
  const [g, setG] = useState<Record<string, { points: string; feedback: string }>>(Object.fromEntries(Object.entries(manual).map(([k, v]) => [k, { points: v.points == null ? '' : String(v.points), feedback: v.feedback }])));
  const { run, pending, error } = useAction(); const router = useRouter();
  const set = (id: string, k: 'points' | 'feedback', v: string) => setG({ ...g, [id]: { points: g[id]?.points ?? '', feedback: g[id]?.feedback ?? '', [k]: v } });
  return (<div className="stack">
    {quiz.questions.map((q, i) => { const v = answers[q.id], a = auto[q.id];
      if (!isScored(q)) return <div key={q.id} className="card"><b>{i + 1}. {q.text}</b><p className="muted small" style={{ margin: '4px 0 0' }}>Rating: {'★'.repeat(+(v as number) || 0) || '—'}</p></div>;
      const shown = q.type === 'single' || q.type === 'tf' ? q.options.find((o) => o.id === v)?.text : q.type === 'multi' ? ((v as string[]) || []).map((x) => q.options.find((o) => o.id === x)?.text).join(', ') : String(v ?? '');
      const key = q.type === 'short' ? String(q.accepted || '').split('\n').filter(Boolean).join(' / ') : q.options.filter((o) => o.correct).map((o) => o.text).join(', ');
      return <div key={q.id} className="card stack" style={{ gap: 8 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}><b>{i + 1}. {q.text}</b><span className="chip">{QT[q.type]} · {q.points} pt{q.points === 1 ? '' : 's'}</span></div>
        <div className="qz-answer">{shown || 'No answer'}</div>{key && <div className="muted small">Answer key: {key}</div>}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}><div className="field" style={{ width: 170 }}><label htmlFor={'qg_' + q.id}>Points (auto: {a == null ? 'needs grading' : a})</label><input id={'qg_' + q.id} type="number" min={0} max={q.points} step={0.5} value={g[q.id]?.points ?? ''} placeholder={a == null ? '' : String(a)} onChange={(e) => set(q.id, 'points', e.target.value)} /></div>
          <div className="field" style={{ flex: 1, minWidth: 220 }}><label htmlFor={'qf_' + q.id}>Feedback to the agent (optional)</label><input id={'qf_' + q.id} value={g[q.id]?.feedback ?? ''} onChange={(e) => set(q.id, 'feedback', e.target.value)} /></div></div></div>; })}
    <div className="err" role="alert">{error}</div>
    <div className="actions"><button className="btn primary" disabled={pending} onClick={() => run(() => gradeSubmission(subId, Object.fromEntries(Object.entries(g).map(([k, v]) => [k, { points: v.points === '' ? null : +v.points, feedback: v.feedback }]))), { success: 'Grades saved. The agent has been notified.', then: () => router.push(`/learning/${itemId}`) })}>Save grades and notify agent</button></div>
  </div>);
}
