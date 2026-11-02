import { describe, it, expect } from 'vitest';
import master from '../src/db/master-data.json';
import { scoreOf } from '../src/lib/scoring';
import { canAuditAgent, canResolveDispute, canViewAudit, canGradeQuiz, can } from '../src/lib/rbac';
import { autoScore, finalScore, validateQuiz, newQuestion, suggestQuestions, quizStats, agentQuizState } from '../src/lib/quiz';
import { auditorAgreement, mode } from '../src/lib/calibration';
import { lineCalc, distribute, targetFor, DEFAULT_PLAN } from '../src/lib/targets';
import { weekEnding, monthLabel } from '../src/lib/dates';
import { feedbackItems, DEFAULT_FB } from '../src/lib/feedback';

const call = master.forms[0];
const answersFor = (N: string[], NA: string[]) => {
  const a: Record<string, string> = {};
  call.sections.forEach((s) => s.params.forEach((p) => (a[p.id] = N.includes(p.id) ? 'N' : NA.includes(p.id) ? 'NA' : 'Y')));
  return a;
};

describe('scoring', () => {
  it('forms total 100 marks', () => {
    master.forms.forEach((f) => expect(f.sections.reduce((s, x) => s + x.params.reduce((a, p) => a + p.weight, 0), 0)).toBe(100));
  });
  it('CC66120: 88% overall, 0% actual (fatal miss)', () => {
    const s = scoreOf(call, answersFor(['c6', 'c25'], ['c22', 'c26']));
    expect(s.overall).toBeCloseTo(88); expect(s.actual).toBe(0); expect(s.fatal).toBe(true);
  });
  it('CC68546: 100% / 100% (NA counts as met)', () => {
    const s = scoreOf(call, answersFor([], ['c6', 'c15', 'c16', 'c17', 'c18', 'c20', 'c21', 'c22', 'c26']));
    expect(s.overall).toBe(100); expect(s.actual).toBe(100);
  });
  it('counts unanswered as not earned and tracks completeness', () => {
    const s = scoreOf(call, { c1: 'Y' });
    expect(s.answered).toBe(1); expect(s.count).toBe(28); expect(s.running).toBe(100);
  });
});

describe('dates', () => {
  it('week ends on Sunday', () => { expect(weekEnding('2026-10-21')).toBe('2026-10-25'); expect(weekEnding('2026-10-25')).toBe('2026-10-25'); });
  it('month label', () => expect(monthLabel('2026-09-13')).toBe('Sep-2026'));
});

describe('roles', () => {
  const tl = { id: 'u6', name: 'Rohit', role: 'tl' as const };
  const qa = { id: 'u3', name: 'Sagar', role: 'auditor' as const };
  const mine = { id: 'a1', role: 'agent', tlId: 'u6' }, other = { id: 'a6', role: 'agent', tlId: 'u7' };
  it('QA Auditor audits all agents; TL only own team', () => {
    expect(canAuditAgent(qa, mine)).toBe(true); expect(canAuditAgent(qa, other)).toBe(true);
    expect(canAuditAgent(tl, mine)).toBe(true); expect(canAuditAgent(tl, other)).toBe(false);
    expect(canAuditAgent({ id: 'u8', name: 'N', role: 'manager' }, mine)).toBe(false);
  });
  it('dispute resolution and visibility', () => {
    const a = { agentId: 'a1', auditorId: 'u6', tlId: 'u6' };
    expect(canResolveDispute(tl, a)).toBe(true); expect(canResolveDispute(qa, a)).toBe(false);
    expect(canViewAudit({ id: 'a2', name: 'x', role: 'agent' }, a)).toBe(false);
    expect(canViewAudit({ id: 'a1', name: 'x', role: 'agent' }, a)).toBe(true);
  });
  it('capabilities', () => {
    expect(can('manager', 'audit.create')).toBe(false); expect(can('manager', 'quiz.grade')).toBe(true);
    expect(can('client', 'reports')).toBe(true); expect(can('client', 'audit.create')).toBe(false);
    expect(canGradeQuiz(qa, { createdBy: 'u4' })).toBe(false); expect(canGradeQuiz(qa, { createdBy: 'u3' })).toBe(true);
  });
});

describe('quiz', () => {
  const single = newQuestion('single'); single.text = 'Q'; single.options[0].text = 'A'; single.options[1].text = 'B';
  const multi = newQuestion('multi'); multi.text = 'M'; multi.options = [{ id: 'x', text: 'x', correct: true }, { id: 'y', text: 'y', correct: true }, { id: 'z', text: 'z', correct: false }];
  const short = newQuestion('short'); short.text = 'S'; short.accepted = 'PNR\nBooking ID';
  const long = newQuestion('long'); long.text = 'L';
  const qz = { enabled: true, passPct: 70, attempts: 2, showAnswers: true, questions: [single, multi, short, long] };
  it('auto-scores objective questions from the key', () => {
    expect(autoScore(single, single.options[0].id)).toBe(1); expect(autoScore(single, single.options[1].id)).toBe(0);
    expect(autoScore(multi, ['y', 'x'])).toBe(1); expect(autoScore(multi, ['x'])).toBe(0);
    expect(autoScore(short, ' pnr ')).toBe(1); expect(autoScore(short, 'something else')).toBeNull();
    expect(autoScore(long, 'text')).toBeNull();
  });
  it('waits for grading, then scores', () => {
    const auto = { [single.id]: 1, [multi.id]: 1, [short.id]: 1, [long.id]: null };
    expect(finalScore(qz, auto, {}).status).toBe('Awaiting grading');
    const f = finalScore(qz, auto, { [long.id]: { points: 1, feedback: '' } });
    expect(f.status).toBe('Scored'); expect(f.score).toBe(4); expect(f.max).toBe(5); expect(f.pct).toBe(80); expect(f.passed).toBe(true);
  });
  it('validates before publishing', () => {
    expect(validateQuiz(qz)).toBe('');
    const bad = newQuestion('single'); expect(validateQuiz({ ...qz, questions: [bad] })).toMatch(/no text/);
  });
  it('suggests questions from legend guidance', () => {
    const p = call.sections.flatMap((s) => s.params).find((x) => x.id === 'c19')!;
    const qs = suggestQuestions([{ code: p.id, name: p.name, channel: 'Call', options: p.options, fatal: p.fatal, weight: p.weight, guideY: p.guideY, guideN: p.guideN, guideNA: p.guideNA }]);
    expect(qs.length).toBeGreaterThan(3); expect(validateQuiz({ ...qz, questions: qs })).toBe('');
  });
  it('agent state and best-attempt stats', () => {
    expect(agentQuizState(qz, false, [])!.state).toBe('locked');
    expect(agentQuizState(qz, true, [])!.state).toBe('todo');
    const s1 = { agentId: 'a1', status: 'Scored', pct: 40, passed: false };
    expect(agentQuizState(qz, true, [s1])!.state).toBe('retry');
    expect(agentQuizState(qz, true, [s1, { ...s1, pct: 50 }])!.state).toBe('failed');
    const st = quizStats([s1, { ...s1, pct: 90, passed: true }, { agentId: 'a2', status: 'Awaiting grading', pct: null, passed: null }]);
    expect(st.takers).toBe(2); expect(st.avg).toBe(90); expect(st.pass).toBe(100); expect(st.awaiting).toBe(1);
  });
});

describe('calibration', () => {
  it('agreement against the agreed rating', () => {
    expect(mode(['Y', 'Y', 'N']).share).toBeCloseTo(66.67, 1);
    const params = [{ id: 'p1', name: 'a', section: 's' }, { id: 'p2', name: 'b', section: 's' }];
    const scores = [
      { userId: 'u3', itemId: 'i', answers: { p1: 'Y', p2: 'N' }, overall: 90, actual: 90 },
      { userId: 'u4', itemId: 'i', answers: { p1: 'Y', p2: 'Y' }, overall: 100, actual: 100 },
      { userId: 'u5', itemId: 'i', answers: { p1: 'N', p2: 'Y' }, overall: 95, actual: 95 },
    ];
    expect(auditorAgreement([{ params, scores, agreed: {} }], 'u4')).toBe(100);
    expect(auditorAgreement([{ params, scores, agreed: { p2: 'N' } }], 'u4')).toBe(50);
  });
});

describe('targets', () => {
  const line = { id: 'l', customer: 'IDFCFIRST', lob: 'Tripstacc', product: 'Flights', channel: 'Call', projected: null, goLive: null, isNew: false, rate: null, override: null, active: true };
  const vols = ['2026-07', '2026-08', '2026-09'].map((m) => ({ customer: 'IDFCFIRST', lob: 'Tripstacc', product: 'Flights', channel: 'Call', month: m, count: 2300 }));
  it('uses the previous 3 months average × sampling rate', () => {
    const c = lineCalc(line, vols, DEFAULT_PLAN, '2026-10');
    expect(c.basis).toBe('History'); expect(c.target).toBe(23);
  });
  it('ramps up new lines and blends projected volume', () => {
    const nl = { ...line, customer: 'BOBCARD', isNew: true, goLive: '2026-09-01', projected: 250 };
    const c = lineCalc(nl, [], DEFAULT_PLAN, '2026-10');
    expect(c.basis).toBe('Projected'); expect(c.ramp).toBe(true); expect(c.target).toBe(5);
  });
  it('distributes by share and converts to weekly', () => {
    const cfg = [{ userId: 'u3', period: 'Monthly', share: 1, lobs: ['Tripstacc'], overrideCalls: null, overrideEmails: null }, { userId: 'u4', period: 'Weekly', share: 1, lobs: ['Tripstacc'], overrideCalls: null, overrideEmails: null }];
    const d = distribute([line], vols, DEFAULT_PLAN, '2026-10', cfg);
    expect(targetFor(cfg[0], d).calls).toBe(12); expect(targetFor(cfg[1], d).calls).toBe(3);
  });
});

describe('feedback tracker', () => {
  it('classifies and flags overdue items', () => {
    const now = Date.parse('2026-10-21T12:00:00Z');
    const items = feedbackItems([
      { id: '1', status: 'Pending acknowledgement', createdAt: '2026-10-18T12:00:00Z' },
      { id: '2', status: 'Pending acknowledgement', createdAt: '2026-10-20T12:00:00Z', deliveredAt: '2026-10-21T10:00:00Z' },
      { id: '3', status: 'Disputed', createdAt: '2026-10-10T12:00:00Z', disputeAt: '2026-10-21T11:00:00Z' },
      { id: '4', status: 'Acknowledged', createdAt: '2026-10-10T12:00:00Z' },
    ], DEFAULT_FB, now);
    expect(items.map((x) => x.type)).toEqual(['undelivered', 'awaitAck', 'dispute']);
    expect(items[0].over).toBe(true);
  });
});
