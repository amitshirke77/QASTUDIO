/**
 * Data scope. The hierarchy is Company › Client › Customer › LOB › Product.
 *  - A client stakeholder (role client) sees only their own client.
 *  - Staff and agents tagged to a company see only that company's clients.
 *  - Group-wide staff (no company) see every company.
 * Every audit carries clientId, so scoping an audit query is one `client_id in (...)` condition.
 */
import { asc, eq, inArray } from 'drizzle-orm';
import { db, schema as t } from '@/db';
import type { SessionUser } from './rbac';

export type Scope = string[] | null; // allowed client IDs; null = everything

/** Pure rule, so it can be unit-tested without a database. */
export function scopeFor(u: Pick<SessionUser, 'role' | 'companyId' | 'clientId'>, clients: { id: string; companyId: string }[]): Scope {
  if (u.role === 'client') return u.clientId ? [u.clientId] : [];
  if (u.companyId) return clients.filter((c) => c.companyId === u.companyId).map((c) => c.id);
  return null;
}
export async function scopeOf(u: SessionUser): Promise<Scope> {
  if (u.role !== 'client' && !u.companyId) return null;
  return scopeFor(u, await db.select({ id: t.clients.id, companyId: t.clients.companyId }).from(t.clients));
}
export const inScope = (s: Scope, clientId: string | null | undefined) => s === null || (!!clientId && s.includes(clientId));

/** Companies and clients this user may see, for pickers and admin screens. */
export async function hierarchy(u?: SessionUser) {
  const [companies, clients] = await Promise.all([db.select().from(t.companies).orderBy(asc(t.companies.name)), db.select().from(t.clients).orderBy(asc(t.clients.name))]);
  const s = u ? scopeFor(u, clients) : null;
  const cl = s === null ? clients : clients.filter((c) => s.includes(c.id));
  return { companies: companies.filter((c) => cl.some((x) => x.companyId === c.id) || s === null), clients: cl };
}
/** Customer names in scope (optionally for one client). */
export async function scopedCustomers(u: SessionUser, clientId?: string | null) {
  const s = await scopeOf(u);
  const rows = await db.select().from(t.customers).orderBy(asc(t.customers.name));
  return rows.filter((c) => c.active && inScope(s, c.clientId) && (!clientId || c.clientId === clientId));
}
/** LOB names in scope. */
export async function scopedLobs(u: SessionUser) {
  const s = await scopeOf(u);
  return (await db.select().from(t.lobs)).filter((l) => inScope(s, l.clientId)).map((l) => l.name);
}
/** The client a customer belongs to; the agent's client wins when the same customer name exists under two clients. */
export async function clientOfCustomer(name: string, prefer?: string | null): Promise<string | null> {
  const rows = await db.select().from(t.customers).where(eq(t.customers.name, name));
  return (rows.find((r) => r.clientId === prefer) || rows[0])?.clientId || prefer || null;
}
/** User IDs (agents, staff) in scope: a user is in scope when their client is, or their company owns an allowed client. */
export async function scopedUserIds(u: SessionUser): Promise<Set<string> | null> {
  const s = await scopeOf(u); if (s === null) return null;
  const cl = await db.select().from(t.clients).where(s.length ? inArray(t.clients.id, s) : eq(t.clients.id, '__none__'));
  const companies = new Set(cl.map((c) => c.companyId));
  const users = await db.select({ id: t.users.id, companyId: t.users.companyId, clientId: t.users.clientId }).from(t.users);
  return new Set(users.filter((x) => (x.clientId && s.includes(x.clientId)) || (!x.clientId && x.companyId && companies.has(x.companyId))).map((x) => x.id));
}
/** Whether an LOB (and so a plan line or volume on it) belongs to a client in the user's scope. */
export async function lobInScope(u: SessionUser, lob: string) {
  const [l] = await db.select().from(t.lobs).where(eq(t.lobs.name, lob));
  return !!l && inScope(await scopeOf(u), l.clientId);
}
/** Users the viewer may see in pickers and lists: everyone in scope, plus group-wide staff (not agents). */
export async function visibleUsers<T extends { id: string; role: string; companyId: string | null }>(u: SessionUser, users: T[]): Promise<T[]> {
  const ids = await scopedUserIds(u); if (!ids) return users;
  return users.filter((x) => ids.has(x.id) || x.id === u.id || (!x.companyId && x.role !== 'agent' && x.role !== 'client'));
}
