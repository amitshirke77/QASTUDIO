import type { AuditX } from './data';
import { avg, groupBy } from './util';
import { MON, fdate, today, weekEnding } from './dates';

export function kpis(A: AuditX[]) {
  return {
    n: A.length, overall: avg(A.map((a) => a.overall)), actual: avg(A.map((a) => a.actual)),
    fatal: A.filter((a) => a.fatal).length, fatalRate: A.length ? (A.filter((a) => a.fatal).length / A.length) * 100 : null,
    ackRate: A.length ? (A.filter((a) => a.status === 'Acknowledged').length / A.length) * 100 : null,
    pending: A.filter((a) => a.status === 'Pending acknowledgement').length, disputed: A.filter((a) => a.status === 'Disputed').length,
    calls: A.filter((a) => a.channel === 'Call').length, emails: A.filter((a) => a.channel === 'Email').length,
  };
}
export type Gran = 'week' | 'month';
export function series(A: AuditX[], gran: Gran = 'week') {
  const g = [...groupBy(A, (a) => (gran === 'week' ? a.weekEnding : a.auditDate.slice(0, 7))).entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1));
  return {
    keys: g.map(([k]) => k),
    labels: g.map(([k]) => (gran === 'week' ? 'WE ' + fdate(k).slice(0, -5) : MON[+k.slice(5, 7) - 1] + ' ' + k.slice(2, 4))),
    overall: g.map(([, v]) => avg(v.map((a) => a.overall))), actual: g.map(([, v]) => avg(v.map((a) => a.actual))),
    n: g.map(([, v]) => v.length), fatalRate: g.map(([, v]) => (v.filter((a) => a.fatal).length / v.length) * 100),
  };
}
export function byKey(A: AuditX[], f: (a: AuditX) => string) {
  return [...groupBy(A, f).entries()].map(([k, v]) => ({ key: k, n: v.length, overall: avg(v.map((a) => a.overall)) ?? 0, actual: avg(v.map((a) => a.actual)) ?? 0, fatal: v.filter((a) => a.fatal).length }));
}
export function paramNRates(A: AuditX[]) {
  const m = new Map<string, { r: number; n: number }>();
  A.forEach((a) => Object.entries(a.answers).forEach(([p, v]) => { const o = m.get(p) || { r: 0, n: 0 }; o.r++; if (v === 'N') o.n++; m.set(p, o); }));
  return [...m.entries()].map(([p, o]) => ({ paramId: p, rated: o.r, no: o.n, rate: (o.n / o.r) * 100 })).sort((a, b) => b.rate - a.rate);
}
export function periodRows(A: AuditX[]) {
  const t = today(), we = weekEnding(t);
  const P = [['LTD', () => true], ['YTD', (a: AuditX) => a.auditDate.slice(0, 4) === t.slice(0, 4)], ['MTD', (a: AuditX) => a.auditDate.slice(0, 7) === t.slice(0, 7)], ['This week', (a: AuditX) => a.weekEnding === we]] as const;
  return P.map(([l, f]) => { const v = A.filter(f); return { label: l, n: v.length, overall: avg(v.map((a) => a.overall)), actual: avg(v.map((a) => a.actual)) }; });
}
export function sectionScores(A: AuditX[], form: { sections: { id: string; name: string; params: { id: string; weight: number }[] }[] }) {
  return form.sections.map((s) => {
    let e = 0, tt = 0;
    A.forEach((a) => s.params.forEach((p) => { const v = a.answers[p.id]; if (!v) return; tt += p.weight; if (v !== 'N') e += p.weight; }));
    return { name: s.name, pct: tt ? (e / tt) * 100 : null };
  });
}
