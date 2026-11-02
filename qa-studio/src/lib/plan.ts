import { and, eq, gte } from 'drizzle-orm';
import { adherence } from './adherence';
import { addDays } from './dates';
import { db, schema as t } from '@/db';
import { getSetting } from './data';
import { DEFAULT_PLAN, distribute, targetFor, lineCalc, type PlanSettings } from './targets';
import { today } from './dates';
export async function planState() {
  const [lines, vols, cfgs] = await Promise.all([db.select().from(t.planLines), db.select().from(t.volumes), db.select().from(t.auditorTargets)]);
  const P = await getSetting<PlanSettings>('plan', DEFAULT_PLAN); const cur = today().slice(0, 7);
  const dist = distribute(lines, vols, P, cur, cfgs);
  return { lines, vols, cfgs, P, cur, dist, calc: lines.map((l) => ({ l, c: lineCalc(l, vols, P, cur) })), target: (id: string) => { const c = cfgs.find((x) => x.userId === id); return c ? targetFor(c, dist) : null; } };
}

/** Plan adherence for one auditor in the current week or month (see lib/adherence.ts). */
export async function adherenceFor(auditorId: string, period?: string) {
  const ps = await planState();
  const t0 = today(); const from = addDays(t0, -40);
  const [agents, audits] = await Promise.all([
    db.select().from(t.users).where(eq(t.users.role, 'agent')),
    db.select({ agentId: t.audits.agentId, customer: t.audits.customer, lob: t.audits.lob, product: t.audits.product, channel: t.audits.channel, auditDate: t.audits.auditDate })
      .from(t.audits).where(and(eq(t.audits.auditorId, auditorId), gte(t.audits.auditDate, from))),
  ]);
  return adherence({ auditorId, cfgs: ps.cfgs, lines: ps.lines, vols: ps.vols, P: ps.P, today: t0, agents: agents.map((a) => ({ id: a.id, name: a.name, lob: a.lob, active: a.active })), audits, period });
}
