import type { Quiz, QuizQuestion } from '@/db/schema';

export const QT: Record<QuizQuestion['type'], string> = { single: 'Choice', multi: 'Multiple answers', tf: 'True / False', short: 'Short text', long: 'Long text', rating: 'Rating' };
export const QT_HINT: Record<QuizQuestion['type'], string> = {
  single: 'One correct option', multi: 'Full points only when every correct option is ticked', tf: 'True or false',
  short: 'Auto-scored when it matches an accepted answer, otherwise graded manually', long: 'Graded manually', rating: '1–5 rating, not scored',
};
let n = 0;
const rid = (p: string) => p + Date.now().toString(36) + (n++).toString(36) + Math.random().toString(36).slice(2, 6);

export function newQuestion(type: QuizQuestion['type']): QuizQuestion {
  const q: QuizQuestion = { id: rid('q'), type, text: '', required: true, points: type === 'rating' ? 0 : type === 'long' ? 2 : 1, options: [], accepted: '' };
  if (type === 'single' || type === 'multi') q.options = [{ id: rid('o'), text: '', correct: true }, { id: rid('o'), text: '', correct: false }];
  if (type === 'tf') q.options = [{ id: rid('o'), text: 'True', correct: true }, { id: rid('o'), text: 'False', correct: false }];
  return q;
}
export const isScored = (q: QuizQuestion) => q.type !== 'rating' && (+q.points || 0) > 0;
export const quizMax = (qz: Quiz) => qz.questions.filter(isScored).reduce((t, q) => t + (+q.points || 0), 0);

/** Points from the answer key, or null when the answer needs manual grading. */
export function autoScore(q: QuizQuestion, v: unknown): number | null {
  const pts = +q.points || 0;
  if (!isScored(q)) return 0;
  if (q.type === 'single' || q.type === 'tf') { const c = q.options.find((o) => o.correct); return v && c && v === c.id ? pts : 0; }
  if (q.type === 'multi') {
    const c = q.options.filter((o) => o.correct).map((o) => o.id).sort().join('|');
    const g = (Array.isArray(v) ? (v as string[]) : []).slice().sort().join('|');
    return c && g === c ? pts : 0;
  }
  if (q.type === 'short') {
    const acc = String(q.accepted || '').split('\n').map((x) => x.trim().toLowerCase()).filter(Boolean);
    if (!acc.length) return null;
    return acc.includes(String(v ?? '').trim().toLowerCase()) ? pts : null;
  }
  return null; // long text
}

export type Manual = Record<string, { points: number | null; feedback: string }>;
export function finalScore(qz: Quiz, auto: Record<string, number | null>, manual: Manual) {
  let got = 0, need = false;
  for (const q of qz.questions) {
    if (!isScored(q)) continue;
    const m = manual[q.id];
    if (m && m.points != null) { got += +m.points; continue; }
    const a = auto[q.id];
    if (a == null) { need = true; continue; }
    got += a;
  }
  const max = quizMax(qz), pctV = max ? (got / max) * 100 : null;
  return { score: got, max, pct: pctV, status: need ? 'Awaiting grading' : 'Scored', passed: need ? null : (pctV ?? 0) >= (+qz.passPct || 0) };
}

export function validateQuiz(qz: Quiz): string {
  if (!qz.questions.length) return 'add at least one question, or remove the quiz.';
  for (const [k, q] of qz.questions.entries()) {
    const name = 'question ' + (k + 1);
    if (!q.text.trim()) return name + ' has no text.';
    if (q.type === 'single' || q.type === 'multi') {
      if (q.options.some((o) => !o.text.trim())) return name + ' has an empty option.';
      if (!q.options.some((o) => o.correct)) return name + ' needs a correct answer.';
    }
    if (q.points < 0) return name + ' has negative points.';
  }
  if (!quizMax(qz)) return 'at least one question must carry points.';
  return '';
}

export function missingRequired(qz: Quiz, ans: Record<string, unknown>) {
  return qz.questions.map((q, i) => [q, i] as const).filter(([q]) => {
    const v = ans[q.id];
    return q.required && (v == null || v === '' || (Array.isArray(v) && !v.length));
  }).map(([, i]) => i + 1);
}

type SuggestParam = { code: string; name: string; channel: string; options: string[]; fatal: boolean; weight: number; guideY: string; guideN: string; guideNA: string };
/** "Intelligent design": draft questions from the linked parameters' legend guidance. */
export function suggestQuestions(params: SuggestParam[]): QuizQuestion[] {
  const out: QuizQuestion[] = [];
  const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1).replace(/\.$/, '');
  for (const p of params) {
    const kind = p.channel === 'Email' ? 'An email' : 'A call';
    if (p.guideN && p.options.length > 1) {
      const q = newQuestion('single');
      q.text = `${kind} shows this: “${p.guideN.replace(/\.$/, '')}”. How should “${p.name}” be rated?`;
      q.options = p.options.map((o) => ({ id: rid('o'), text: o === 'Y' ? 'Y – met' : o === 'N' ? 'N – not met' : 'NA – not applicable', correct: o === 'N' }));
      out.push(q);
    }
    if (p.guideY) { const q = newQuestion('tf'); q.text = `True or false: “${p.name}” is rated Y when ${lc(p.guideY)}.`; out.push(q); }
    if (p.guideNA && p.options.includes('NA') && !/^not used|^not allowed|^rarely/i.test(p.guideNA)) {
      const q = newQuestion('single'); q.text = `When is “${p.name}” rated NA?`;
      q.options = [{ id: rid('o'), text: p.guideNA.replace(/\.$/, ''), correct: true }, ...[p.guideY, p.guideN].filter(Boolean).slice(0, 2).map((t) => ({ id: rid('o'), text: t.replace(/\.$/, ''), correct: false }))];
      out.push(q);
    }
    { const q = newQuestion('tf'); q.text = `True or false: “${p.name}” is a fatal parameter, so a “No” makes the Actual quality score 0.`; q.options[0].correct = p.fatal; q.options[1].correct = !p.fatal; out.push(q); }
    {
      const w = +p.weight, q = newQuestion('single');
      q.text = `How many marks does “${p.name}” carry on the ${p.channel === 'Email' ? 'email' : 'call'} form?`;
      const opts = [...new Set([w, w + 1, Math.max(1, w - 1), w * 2])].slice(0, 4).sort((a, b) => a - b);
      q.options = opts.map((v) => ({ id: rid('o'), text: String(v), correct: v === w }));
      out.push(q);
    }
  }
  const l = newQuestion('long'); l.text = 'In your own words, what will you do differently on your next interaction?'; l.points = 2; out.push(l);
  return out.slice(0, 12);
}

type Sub = { agentId: string; status: string; pct: number | null; passed: boolean | null };
/** Best attempt per agent. */
export function quizStats(subs: Sub[]) {
  const best = new Map<string, Sub>();
  for (const s of subs) {
    const b = best.get(s.agentId);
    if (!b || (s.status === 'Scored' && (b.status !== 'Scored' || (s.pct ?? 0) > (b.pct ?? 0)))) best.set(s.agentId, s);
  }
  const fin = [...best.values()].filter((s) => s.status === 'Scored');
  const avgV = fin.length ? fin.reduce((t, s) => t + (s.pct ?? 0), 0) / fin.length : null;
  return { subs: subs.length, takers: best.size, awaiting: subs.filter((s) => s.status === 'Awaiting grading').length, avg: avgV, pass: fin.length ? (fin.filter((s) => s.passed).length / fin.length) * 100 : null, fin };
}

export type QuizState = { state: 'locked' | 'todo' | 'grading' | 'passed' | 'retry' | 'failed'; label: string; left: number };
export function agentQuizState(qz: Quiz | null | undefined, accepted: boolean, subs: Sub[]): QuizState | null {
  if (!qz || !qz.enabled) return null;
  const left = (+qz.attempts || 1) - subs.length, last = subs[subs.length - 1];
  const p = (v: number | null) => (v == null ? '—' : v.toFixed(1) + '%');
  if (!accepted) return { state: 'locked', label: 'Accept the training first', left };
  if (!last) return { state: 'todo', label: 'Quiz to take', left };
  if (last.status === 'Awaiting grading') return { state: 'grading', label: 'Waiting for grading', left };
  if (last.passed) return { state: 'passed', label: `Passed · ${p(last.pct)}`, left };
  return left > 0 ? { state: 'retry', label: `Not passed · ${p(last.pct)} · ${left} attempt${left === 1 ? '' : 's'} left`, left } : { state: 'failed', label: `Not passed · ${p(last.pct)}`, left };
}
