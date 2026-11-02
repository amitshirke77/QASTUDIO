import { monthsBetween, prevMonths } from './dates';

export type PlanSettings = { rates: { Call: number; Email: number }; min: number; newMult: number; ramp: number };
export const DEFAULT_PLAN: PlanSettings = { rates: { Call: 1, Email: 1.5 }, min: 2, newMult: 2, ramp: 3 };
export type PlanLine = { id: string; customer: string; lob: string; product: string; channel: string; projected: number | null; goLive: string | null; isNew: boolean; rate: number | null; override: number | null; active: boolean };
export type Volume = { customer: string; lob: string; product: string; channel: string; month: string; count: number };
const key = (x: { customer: string; lob: string; product: string; channel: string }) => [x.customer, x.lob, x.product, x.channel].join('|');

/**
 * Monthly audit target for one customer · LOB · product · channel line.
 * Basis: the previous 3 complete months' average volume. New lines blend a projected volume
 * for missing months, and get a ramp-up multiplier for `ramp` months after go-live.
 */
export function lineCalc(l: PlanLine, vols: Volume[], P: PlanSettings, curMonth: string) {
  const bm = prevMonths(curMonth, 3), k = key(l);
  const hist = bm.map((m) => { const v = vols.find((x) => x.month === m && key(x) === k); return v ? v.count : null; });
  const have = hist.filter((v): v is number => v != null && v > 0), proj = +(l.projected || 0);
  let basis: string, avgV: number;
  if (have.length === 3) { basis = 'History'; avgV = have.reduce((a, b) => a + b, 0) / 3; }
  else if (have.length && proj) { basis = 'Blended'; avgV = (have.reduce((a, b) => a + b, 0) + proj * (3 - have.length)) / 3; }
  else if (have.length) { basis = 'Partial'; avgV = have.reduce((a, b) => a + b, 0) / have.length; }
  else if (proj) { basis = 'Projected'; avgV = proj; }
  else { basis = 'No volume'; avgV = 0; }
  const ramp = !!(l.isNew && l.goLive && monthsBetween(l.goLive.slice(0, 7), curMonth) < (+P.ramp || 0));
  const rate = l.rate != null ? +l.rate : +P.rates[l.channel as 'Call' | 'Email'];
  const mult = ramp ? +P.newMult || 1 : 1;
  const calc = avgV ? Math.max(+P.min || 0, Math.ceil((avgV * rate) / 100 * mult)) : 0;
  const target = !l.active ? 0 : l.override != null ? +l.override : calc;
  return { basis, hist, avg: avgV, rate, ramp, calc, target };
}

export type AuditorCfg = { userId: string; period: string; share: number; lobs: string[]; overrideCalls: number | null; overrideEmails: number | null };
/** Split each line's monthly target across eligible auditors by share; returns monthly calls/emails per auditor. */
export function distribute(lines: PlanLine[], vols: Volume[], P: PlanSettings, cur: string, cfgs: AuditorCfg[]) {
  const out: Record<string, { Call: number; Email: number }> = {}; const un = { Call: 0, Email: 0 };
  cfgs.forEach((c) => (out[c.userId] = { Call: 0, Email: 0 }));
  for (const l of lines) {
    const c = lineCalc(l, vols, P, cur); if (!c.target) continue;
    const el = cfgs.filter((g) => +g.share > 0 && g.lobs.includes(l.lob));
    const tot = el.reduce((s, g) => s + +g.share, 0);
    const ch = l.channel as 'Call' | 'Email';
    if (!tot) { un[ch] += c.target; continue; }
    el.forEach((g) => (out[g.userId][ch] += (c.target * +g.share) / tot));
  }
  return { out, un };
}
export function toPeriod(monthly: number, period: string) { return period === 'Weekly' ? (monthly * 12) / 52 : monthly; }
export function targetFor(cfg: AuditorCfg, dist: { out: Record<string, { Call: number; Email: number }> }) {
  const d = dist.out[cfg.userId] || { Call: 0, Email: 0 };
  const pc = Math.max(0, Math.ceil(toPeriod(d.Call, cfg.period) - 1e-9)), pe = Math.max(0, Math.ceil(toPeriod(d.Email, cfg.period) - 1e-9));
  return { period: cfg.period, calls: cfg.overrideCalls ?? pc, emails: cfg.overrideEmails ?? pe, planCalls: pc, planEmails: pe };
}
