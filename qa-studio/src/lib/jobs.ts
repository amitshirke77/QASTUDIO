import { eq } from 'drizzle-orm';
import { db, schema as t } from '@/db';
import { getSetting } from './data';

/** Dispute-window best practice: auto-acknowledge audits left pending beyond the window. Run by cron. */
export async function autoAcknowledge() {
  const win = (await getSetting<Record<string, { status: string; value?: number }>>('bp', {})).disputeWindow;
  if (win?.status !== 'approved') return 0;
  const cutoff = Date.now() - (+(win.value || 72)) * 3600e3;
  const pend = (await db.select().from(t.audits).where(eq(t.audits.status, 'Pending acknowledgement'))).filter((a) => +a.createdAt < cutoff);
  for (const a of pend) {
    await db.insert(t.acknowledgements).values({ auditId: a.id, at: new Date(), auto: true, suggestion: '' }).onConflictDoNothing();
    await db.update(t.audits).set({ status: 'Acknowledged' }).where(eq(t.audits.id, a.id));
  }
  return pend.length;
}
