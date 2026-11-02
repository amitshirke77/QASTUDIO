'use server';
import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db, schema as t } from '@/db';
import { requireUser } from '@/lib/auth';
import { notify, logAct } from '@/lib/notify';
import { setSetting } from '@/lib/data';
import { uid } from '@/lib/util';
import { today } from '@/lib/dates';
import { done, fail, zDate, zErr, type Result } from './_util';
import { scopeOf, inScope, lobInScope } from '@/lib/scope';

const AllocZ = z.object({ agentIds: z.array(z.string()).min(1, 'Pick at least one agent'), auditorId: z.string().min(1, 'Pick an auditor'), channel: z.enum(['Call', 'Email']), count: z.number().int().min(1).max(20), dueDate: zDate, note: z.string().max(500).default('') });
export async function createAllocations(input: z.input<typeof AllocZ>): Promise<Result<{ n: number }>> {
  const u = await requireUser('allocate');
  const p = AllocZ.safeParse(input); if (!p.success) return fail(zErr(p.error));
  const d = p.data; if (d.dueDate < today()) return fail('The due date is in the past.');
  const rows = d.agentIds.flatMap((agentId) => Array.from({ length: d.count }, () => ({ id: uid('al'), agentId, auditorId: d.auditorId, channel: d.channel, dueDate: d.dueDate, note: d.note, createdBy: u.id })));
  await db.insert(t.allocations).values(rows);
  await notify(d.auditorId, `${rows.length} ${d.channel.toLowerCase()} audit${rows.length > 1 ? 's' : ''} allocated to you, due ${d.dueDate}.`, '/queue');
  await logAct(u.id, `${u.name} allocated ${rows.length} audits`);
  revalidatePath('/allocations'); return done({ n: rows.length });
}
export async function cancelAllocation(id: string): Promise<Result> {
  await requireUser('allocate');
  await db.update(t.allocations).set({ status: 'Cancelled' }).where(and(eq(t.allocations.id, id), eq(t.allocations.status, 'Pending')));
  revalidatePath('/allocations'); return done();
}

const LineZ = z.object({ id: z.string().optional(), customer: z.string().min(1), lob: z.string().min(1), product: z.string().min(1), channel: z.enum(['Call', 'Email']), projected: z.number().int().min(0).nullable(), goLive: z.string().nullable(), isNew: z.boolean(), rate: z.number().min(0).max(100).nullable(), override: z.number().int().min(0).nullable(), active: z.boolean() });
export async function savePlanLine(input: z.input<typeof LineZ>): Promise<Result> {
  await requireUser('targets.manage');
  const p = LineZ.safeParse(input); if (!p.success) return fail(zErr(p.error));
  if (!(await lobInScope(await requireUser('targets.manage'), p.data.lob))) return fail('That LOB belongs to a client outside your scope.');
  const { id, ...v } = p.data;
  if (id) await db.update(t.planLines).set(v).where(eq(t.planLines.id, id)); else await db.insert(t.planLines).values({ id: uid('pl'), ...v });
  revalidatePath('/targets'); return done();
}
/** Add a customer (new or existing) of one client, with several products at once; each product gets its own projected calls and emails. */
const CustProdZ = z.object({
  clientId: z.string().min(1, 'Pick the client.'),
  customer: z.string().trim().min(1, 'Enter a customer.').max(60),
  goLive: z.string().nullable(),
  items: z.array(z.object({ lob: z.string().trim().min(1).max(60), product: z.string().trim().min(1).max(60), calls: z.number().int().min(0), emails: z.number().int().min(0) })).min(1, 'Tick at least one product.'),
});
export async function addCustomerProducts(input: z.input<typeof CustProdZ>): Promise<Result<{ lines: number }>> {
  const u = await requireUser('targets.manage');
  const p = CustProdZ.safeParse(input); if (!p.success) return fail(zErr(p.error));
  const { goLive, items, clientId } = p.data; const customer = p.data.customer.toUpperCase();
  if (!inScope(await scopeOf(u), clientId)) return fail('Pick one of your clients.');
  const [client] = await db.select().from(t.clients).where(eq(t.clients.id, clientId)); if (!client) return fail('Client not found.');
  const miss = items.filter((i) => !i.calls && !i.emails).map((i) => i.product);
  if (miss.length) return fail(`Enter projected calls, emails or both for ${miss.join(', ')}.`);
  const keys = new Set<string>(); for (const i of items) { const k = `${i.lob.toLowerCase()}|${i.product.toLowerCase()}`; if (keys.has(k)) return fail(`${i.product} is listed twice.`); keys.add(k); }
  const created: string[] = [];
  const cu = await db.select().from(t.customers).where(eq(t.customers.clientId, clientId));
  if (!cu.some((c) => c.name.toUpperCase() === customer)) { await db.insert(t.customers).values({ id: uid('cu'), clientId, name: customer }); created.push('customer ' + customer); }
  const allLobs = await db.select().from(t.lobs), prods = await db.select().from(t.products);
  const mine = allLobs.filter((l) => l.clientId === clientId).map((l) => l.name);
  const lines = await db.select().from(t.planLines).where(eq(t.planLines.customer, customer));
  let n = 0;
  for (const i of items) {
    let lob = mine.find((l) => l.toLowerCase() === i.lob.toLowerCase());
    if (!lob) {
      if (allLobs.some((l) => l.name.toLowerCase() === i.lob.toLowerCase())) return fail(`${i.lob} is an LOB of another client.`);
      lob = i.lob; await db.insert(t.lobs).values({ name: lob, clientId }); mine.push(lob); allLobs.push({ name: lob, clientId }); created.push('LOB ' + lob);
    }
    const product = prods.find((x) => x.lob === lob && x.name.toLowerCase() === i.product.toLowerCase())?.name || i.product;
    if (!prods.some((x) => x.lob === lob && x.name === product)) { const row = { id: uid('pr'), lob, name: product }; await db.insert(t.products).values(row); prods.push(row); created.push('product ' + product); }
    for (const [channel, v] of [['Call', i.calls], ['Email', i.emails]] as const) {
      if (!v) continue;
      const ex = lines.find((l) => l.lob === lob && l.product === product && l.channel === channel);
      const vals = { projected: v, goLive: goLive || today(), isNew: true, active: true };
      if (ex) await db.update(t.planLines).set(vals).where(eq(t.planLines.id, ex.id));
      else await db.insert(t.planLines).values({ id: uid('pl'), customer, lob, product, channel, rate: null, override: null, ...vals });
      n++;
    }
  }
  await logAct(u.id, `Added ${client.name} › ${customer} · ${items.map((i) => i.product).join(', ')} to the volume plan${created.length ? ` (new ${created.join(', ')})` : ''}`);
  revalidatePath('/targets'); revalidatePath('/admin/masters'); return done({ lines: n });
}
export async function saveVolume(customer: string, lob: string, product: string, channel: string, month: string, count: number): Promise<Result> {
  await requireUser('targets.manage');
  if (!/^\d{4}-\d{2}$/.test(month) || !(count >= 0)) return fail('Invalid month or volume.');
  if (!(await lobInScope(await requireUser('targets.manage'), lob))) return fail('That LOB belongs to a client outside your scope.');
  const ex = await db.select().from(t.volumes).where(and(eq(t.volumes.customer, customer), eq(t.volumes.lob, lob), eq(t.volumes.product, product), eq(t.volumes.channel, channel), eq(t.volumes.month, month)));
  if (ex[0]) await db.update(t.volumes).set({ count: Math.round(count) }).where(eq(t.volumes.id, ex[0].id));
  else await db.insert(t.volumes).values({ id: uid('v'), customer, lob, product, channel, month, count: Math.round(count) });
  revalidatePath('/targets'); return done();
}
const TgtZ = z.object({ userId: z.string(), period: z.enum(['Weekly', 'Monthly']), share: z.number().min(0).max(10), lobs: z.array(z.string()), overrideCalls: z.number().int().min(0).nullable(), overrideEmails: z.number().int().min(0).nullable() });
export async function saveAuditorTarget(input: z.input<typeof TgtZ>): Promise<Result> {
  await requireUser('targets.manage');
  const p = TgtZ.safeParse(input); if (!p.success) return fail(zErr(p.error));
  const { userId, ...v } = p.data;
  await db.insert(t.auditorTargets).values({ userId, ...v }).onConflictDoUpdate({ target: t.auditorTargets.userId, set: v });
  revalidatePath('/targets'); return done();
}
export async function savePlanSettings(v: { rates: { Call: number; Email: number }; min: number; newMult: number; ramp: number }): Promise<Result> {
  await requireUser('targets.manage');
  if ([v.rates.Call, v.rates.Email, v.min, v.newMult, v.ramp].some((x) => !(x >= 0) || x > 100)) return fail('Check the values.');
  await setSetting('plan', v); revalidatePath('/targets'); return done();
}

export async function markNotificationsRead(ids?: string[]): Promise<Result> {
  const u = await requireUser();
  if (ids?.length) await db.update(t.notifications).set({ read: true }).where(and(eq(t.notifications.userId, u.id), inArray(t.notifications.id, ids)));
  else await db.update(t.notifications).set({ read: true }).where(eq(t.notifications.userId, u.id));
  revalidatePath('/', 'layout'); return done();
}

const CrZ = z.object({ id: z.string().optional(), name: z.string().trim().min(1, 'Give the report a name').max(120), purpose: z.string().max(2000), cols: z.string().max(4000), filters: z.string().max(500), audience: z.string().max(200), freq: z.string().max(30) });
export async function saveCustomReport(input: z.input<typeof CrZ>): Promise<Result<{ id: string }>> {
  const u = await requireUser('reports.custom');
  const p = CrZ.safeParse(input); if (!p.success) return fail(zErr(p.error));
  const { id, ...v } = p.data;
  if (id) { await db.update(t.customReports).set(v).where(eq(t.customReports.id, id)); revalidatePath('/reports'); return done({ id }); }
  const nid = uid('cr_'); await db.insert(t.customReports).values({ id: nid, ...v, by: u.id, at: today() });
  await logAct(u.id, `Added custom report "${v.name}"`); revalidatePath('/reports'); return done({ id: nid });
}
export async function deleteCustomReport(id: string): Promise<Result> {
  await requireUser('reports.custom'); await db.delete(t.customReports).where(eq(t.customReports.id, id)); revalidatePath('/reports'); return done();
}
