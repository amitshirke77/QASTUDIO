/**
 * Audit plan adherence for one auditor.
 *
 * The volume plan gives each customer · LOB · product · channel line a monthly audit target
 * (previous 3 months' average volume × sampling rate). Each line is split across the auditors
 * whose LOBs include it, by share. This module turns the auditor's slice of every line into a
 * plan for the current week or month, splits it across the agents in that LOB, compares it with
 * the audits already done, and ranks what to audit next so the auditor's mix matches the plan.
 */
import { addDays, parseD, weekEnding } from './dates';
import { lineCalc, toPeriod, type AuditorCfg, type PlanLine, type PlanSettings, type Volume } from './targets';

export type AdhAgent = { id: string; name: string; lob: string | null; active: boolean };
export type AdhAudit = { agentId: string; customer: string; lob: string; product: string; channel: string; auditDate: string };
export type Row = { key: string; label: string; plan: number; expected: number; done: number; gap: number; planShare: number; doneShare: number };
export type AgentRow = { id: string; name: string; lob: string; planCalls: number; planEmails: number; doneCalls: number; doneEmails: number; expected: number; done: number; gap: number; status: 'Ahead' | 'On pace' | 'Behind' | 'Not started' | 'Not in plan' };
export type Suggestion = { agentId: string; agentName: string; customer: string; lob: string; product: string; channel: string; reason: string; score: number };

const lineKey = (x: { customer: string; lob: string; product: string; channel: string }) => [x.customer, x.lob, x.product, x.channel].join('|');

/** Working days are Monday–Saturday. Returns the period's range and how much of it has elapsed (0–1). */
export function periodWindow(period: string, today: string) {
  const work = (d: string) => parseD(d).getUTCDay() !== 0;
  let from: string, to: string;
  if (period === 'Monthly') { from = today.slice(0, 8) + '01'; const [y, m] = today.split('-').map(Number); to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); }
  else { to = weekEnding(today); from = addDays(to, -6); }
  let total = 0, gone = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) if (work(d)) { total++; if (d <= today) gone++; }
  return { from, to, elapsed: total ? gone / total : 1, workDays: total, workDaysGone: gone };
}

export function adherence(input: {
  auditorId: string; cfgs: AuditorCfg[]; lines: PlanLine[]; vols: Volume[]; P: PlanSettings; today: string;
  agents: AdhAgent[]; audits: AdhAudit[]; period?: string;
}) {
  const cfg = input.cfgs.find((c) => c.userId === input.auditorId);
  if (!cfg) return null;
  const period = input.period || cfg.period;
  const win = periodWindow(period, input.today);
  const cur = input.today.slice(0, 7);
  // 1. the auditor's slice of each line, for the period
  const slices: { line: PlanLine; plan: number }[] = [];
  for (const l of input.lines) {
    if (!l.active) continue;
    const c = lineCalc(l, input.vols, input.P, cur); if (!c.target) continue;
    const el = input.cfgs.filter((g) => +g.share > 0 && g.lobs.includes(l.lob));
    if (!el.some((g) => g.userId === cfg.userId)) continue;
    const tot = el.reduce((s, g) => s + +g.share, 0);
    slices.push({ line: l, plan: toPeriod((c.target * +cfg.share) / tot, period) });
  }
  // overrides replace the plan total per channel; keep the mix, rescale the size
  for (const ch of ['Call', 'Email'] as const) {
    const ov = ch === 'Call' ? cfg.overrideCalls : cfg.overrideEmails;
    if (ov == null) continue;
    const s = slices.filter((x) => x.line.channel === ch); const sum = s.reduce((a, x) => a + x.plan, 0);
    if (sum > 0) s.forEach((x) => (x.plan = (x.plan * ov) / sum));
  }
  const audits = input.audits.filter((a) => a.auditDate >= win.from && a.auditDate <= win.to);
  const planTotal = slices.reduce((s, x) => s + x.plan, 0), doneTotal = audits.length;
  const mk = (key: string, label: string, plan: number, done: number): Row => {
    const expected = plan * win.elapsed;
    return { key, label, plan, expected, done, gap: expected - done, planShare: planTotal ? (plan / planTotal) * 100 : 0, doneShare: doneTotal ? (done / doneTotal) * 100 : 0 };
  };
  const group = (f: (x: { customer: string; lob: string; product: string; channel: string }) => string, label: (k: string) => string) => {
    const keys = new Set([...slices.map((s) => f(s.line)), ...audits.map((a) => f(a))]);
    return [...keys].map((k) => mk(k, label(k), slices.filter((s) => f(s.line) === k).reduce((a, s) => a + s.plan, 0), audits.filter((a) => f(a) === k).length)).sort((a, b) => b.plan - a.plan);
  };
  const byLine = group(lineKey, (k) => { const [c, l, p, ch] = k.split('|'); return `${c} · ${l} · ${p} · ${ch}`; });
  const byChannel = group((x) => x.channel, (k) => k);
  const byClient = group((x) => x.customer, (k) => k);
  const byProduct = group((x) => `${x.lob} · ${x.product}`, (k) => k);
  // 2. agent-wise: each line's plan is split equally across the active agents in that LOB
  const agentsIn = (lob: string) => input.agents.filter((a) => a.active && a.lob === lob);
  const agentMap = new Map<string, AgentRow>();
  const ensure = (a: AdhAgent) => { let r = agentMap.get(a.id); if (!r) { r = { id: a.id, name: a.name, lob: a.lob || '', planCalls: 0, planEmails: 0, doneCalls: 0, doneEmails: 0, expected: 0, done: 0, gap: 0, status: 'Not started' }; agentMap.set(a.id, r); } return r; };
  for (const s of slices) { const ag = agentsIn(s.line.lob); if (!ag.length) continue; ag.forEach((a) => { const r = ensure(a); if (s.line.channel === 'Call') r.planCalls += s.plan / ag.length; else r.planEmails += s.plan / ag.length; }); }
  for (const a of audits) { const ag = input.agents.find((x) => x.id === a.agentId); if (!ag) continue; const r = ensure(ag); if (a.channel === 'Call') r.doneCalls++; else r.doneEmails++; }
  const agentRows = [...agentMap.values()].map((r) => {
    const plan = r.planCalls + r.planEmails, done = r.doneCalls + r.doneEmails, expected = plan * win.elapsed;
    const status: AgentRow['status'] = plan === 0 ? 'Not in plan' : !done ? 'Not started' : done >= plan && plan > 0 ? 'Ahead' : done + 0.5 >= expected ? 'On pace' : 'Behind';
    return { ...r, expected, done, gap: expected - done, status };
  }).sort((a, b) => b.gap - a.gap);
  // 3. what to audit next: lines furthest behind, paired with the agent in that LOB furthest behind on that channel
  const agentChannelGap = (r: AgentRow, ch: string) => (ch === 'Call' ? r.planCalls - r.doneCalls : r.planEmails - r.doneEmails);
  const suggestions: Suggestion[] = [];
  const used = new Map<string, number>();
  const lineRows = byLine.filter((r) => r.plan > 0).map((r) => ({ r, remaining: r.plan - r.done })).filter((x) => x.remaining > 0.25).sort((a, b) => b.r.gap - a.r.gap || b.remaining - a.remaining);
  for (const { r } of lineRows) {
    const [customer, lob, product, channel] = r.key.split('|');
    const cands = agentRows.filter((a) => a.lob === lob && (channel === 'Call' ? a.planCalls - a.doneCalls : a.planEmails - a.doneEmails) > 0.25)
      .map((a) => ({ a, g: agentChannelGap(a, channel) - (used.get(a.id) || 0) })).sort((x, y) => y.g - x.g);
    const pick = cands[0]; if (!pick) continue;
    used.set(pick.a.id, (used.get(pick.a.id) || 0) + 1);
    const behind = Math.max(0, r.gap);
    suggestions.push({ agentId: pick.a.id, agentName: pick.a.name, customer, lob, product, channel, score: behind + pick.g,
      reason: `${customer} ${product} ${channel.toLowerCase()}s: ${r.done} of ${Math.round(r.plan * 10) / 10} planned${behind >= 0.5 ? `, ${Math.round(behind * 10) / 10} behind pace` : ''} · ${pick.a.name}: ${channel === 'Call' ? pick.a.doneCalls : pick.a.doneEmails} of ${Math.round((channel === 'Call' ? pick.a.planCalls : pick.a.planEmails) * 10) / 10}` });
    if (suggestions.length >= 6) break;
  }
  const expectedTotal = planTotal * win.elapsed;
  const mixGap = byLine.reduce((s, r) => s + Math.abs(r.planShare - r.doneShare), 0) / 2; // 0 = mix matches the plan exactly
  return {
    period, ...win, planTotal, expectedTotal, doneTotal,
    status: doneTotal >= planTotal && planTotal > 0 ? 'Plan met' : doneTotal + 0.5 >= expectedTotal ? 'On pace' : 'Behind pace',
    mixMatch: doneTotal ? Math.max(0, 100 - mixGap) : null,
    byLine, byChannel, byClient, byProduct, agentRows, suggestions,
  };
}
export type Adherence = NonNullable<ReturnType<typeof adherence>>;
