import { and, eq, gte, inArray } from 'drizzle-orm';
import { db, schema as t } from '@/db';
import type { Audience } from '@/db/schema';
import { addDays, today } from './dates';

/** Agents an audience resolves to. "missed" = agents rated No on any linked parameter (by code) in the last N days. */
export async function audienceAgents(aud: Audience) {
  const ags = await db.select().from(t.users).where(and(eq(t.users.role, 'agent'), eq(t.users.active, true)));
  if (aud.kind === 'all') return ags;
  if (aud.kind === 'lob') return ags.filter((a) => a.lob === aud.value);
  if (aud.kind === 'team') return ags.filter((a) => a.tlId === aud.value);
  if (aud.kind === 'agents') return ags.filter((a) => (aud.agents || []).includes(a.id));
  if (aud.kind === 'missed') {
    const codes = aud.params || []; if (!codes.length) return [];
    const pids = (await db.select({ id: t.params.id }).from(t.params).where(inArray(t.params.code, codes))).map((p) => p.id);
    if (!pids.length) return [];
    const since = addDays(today(), -(+(aud.days || 30)));
    const rows = await db.selectDistinct({ agentId: t.audits.agentId }).from(t.answers).innerJoin(t.audits, eq(t.answers.auditId, t.audits.id))
      .where(and(inArray(t.answers.paramId, pids), eq(t.answers.value, 'N'), gte(t.audits.auditDate, since)));
    const ids = new Set(rows.map((r) => r.agentId));
    return ags.filter((a) => ids.has(a.id));
  }
  return [];
}
