export type FbTargets = { deliverH: number; disputeH: number; ackH: number };
export const DEFAULT_FB: FbTargets = { deliverH: 48, disputeH: 48, ackH: 72 };
export type FbAudit = { id: string; status: string; createdAt: Date | string; deliveredAt?: Date | string | null; disputeAt?: Date | string | null; resolvedAt?: Date | string | null };
export type FbType = 'undelivered' | 'awaitAck' | 'dispute';
export const FB_LABEL: Record<FbType, [string, string]> = { undelivered: ['Feedback not delivered', 'warn'], awaitAck: ['Delivered, awaiting agent', 'acc'], dispute: ['Dispute open', 'bad'] };

/** Open feedback items: not delivered, delivered but not acknowledged, disputes not resolved. */
export function feedbackItems<T extends FbAudit>(audits: T[], c: FbTargets, now = Date.now()) {
  const out: { a: T; type: FbType; since: string; ageH: number; dueH: number; over: boolean; next: string }[] = [];
  for (const a of audits) {
    let type: FbType | null = null, since: Date | string | null | undefined = null, due = 0, next = '';
    if (a.status === 'Pending acknowledgement' && !a.deliveredAt) { type = 'undelivered'; since = a.createdAt; due = c.deliverH; next = 'Hold the feedback session with the agent and log it'; }
    else if (a.status === 'Pending acknowledgement') { type = 'awaitAck'; since = a.deliveredAt; due = c.ackH; next = 'Agent to acknowledge or dispute'; }
    else if (a.status === 'Disputed') { type = 'dispute'; since = a.disputeAt || a.createdAt; due = c.disputeH; next = 'Review the disputed ratings and resolve'; }
    else if (a.status === 'Dispute resolved') { type = 'awaitAck'; since = a.resolvedAt || a.createdAt; due = c.ackH; next = 'Agent to acknowledge the dispute outcome'; }
    if (!type || !since) continue;
    const ageH = Math.max(0, (now - new Date(since).getTime()) / 36e5);
    out.push({ a, type, since: new Date(since).toISOString(), ageH, dueH: due, over: ageH > due, next });
  }
  return out.sort((x, y) => Number(y.over) - Number(x.over) || y.ageH - x.ageH);
}
export function fbAge(h: number) { if (h < 1) return Math.round(h * 60) + 'm'; if (h < 48) return Math.round(h) + 'h'; return Math.round(h / 24) + 'd'; }
