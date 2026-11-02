'use server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { and, eq, ne, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db, schema as t } from '@/db';
import { requireUser } from '@/lib/auth';
import { ROLE_KEYS } from '@/lib/rbac';
import { getForm, setSetting } from '@/lib/data';
import { logAct } from '@/lib/notify';
import { uid } from '@/lib/util';
import { done, fail, zErr, type Result } from './_util';

const UserZ = z.object({
  id: z.string().optional(), name: z.string().trim().min(2).max(100), role: z.enum(ROLE_KEYS as [string, ...string[]]),
  email: z.string().trim().email().or(z.literal('')).optional(), username: z.string().trim().min(2).max(60).regex(/^[A-Za-z0-9._@-]+$/, 'Letters, numbers and . _ - @ only'),
  password: z.string().optional(), authSso: z.boolean(), authPassword: z.boolean(), active: z.boolean(), lob: z.string().nullable(), tlId: z.string().nullable(),
  companyId: z.string().nullable().optional(), clientId: z.string().nullable().optional(),
});
export async function saveUser(input: z.input<typeof UserZ>): Promise<Result> {
  const u = await requireUser('admin.users');
  const p = UserZ.safeParse(input); if (!p.success) return fail(zErr(p.error));
  const d = p.data;
  // where the user sits in Company › Client; company admins manage only their own company
  const clients = await db.select().from(t.clients);
  let companyId = d.companyId || null, clientId = d.clientId || null;
  if (d.role === 'client' || d.role === 'agent') {
    const cl = clients.find((c) => c.id === clientId); if (!cl) return fail(d.role === 'client' ? 'Pick the client this stakeholder belongs to.' : 'Pick the client program this agent works on.');
    companyId = cl.companyId;
  } else clientId = null;
  if (u.companyId && companyId !== u.companyId) return fail('You can manage users only in your own company.');
  if (!u.companyId && !companyId && d.role !== 'admin' && d.role !== 'manager') return fail('Pick a company. Only Admins and Managers can be group-wide.');
  if (d.role === 'client' && d.email) { const cl = clients.find((c) => c.id === clientId)!; const dom = d.email.toLowerCase().split('@')[1]; if (d.authSso && !cl.ssoDomains.includes(dom)) return fail(`For Microsoft 365 sign-in, the email must be on ${cl.ssoDomains.join(' or ') || 'a domain set up for ' + cl.name + ' (Master data › Clients)'}.`); }
  if (d.role === 'agent' && (!d.lob || !d.tlId)) return fail('Agents need an LOB and a Team Leader.');
  if (d.role === 'agent') { const [l] = await db.select().from(t.lobs).where(eq(t.lobs.name, d.lob!)); if (!l || l.clientId !== clientId) return fail('That LOB does not belong to the agent\'s client.'); }
  if (!d.authSso && !d.authPassword) return fail('Allow at least one way to sign in.');
  if (d.password && d.password.length < 8) return fail('Passwords need at least 8 characters.');
  const dup = await db.select().from(t.users).where(and(sql`lower(${t.users.username}) = ${d.username.toLowerCase()}`, d.id ? ne(t.users.id, d.id) : sql`true`));
  if (dup.length) return fail('That username is taken.');
  const hash = d.password ? await bcrypt.hash(d.password, 10) : undefined;
  if (d.id) {
    const [ex] = await db.select().from(t.users).where(eq(t.users.id, d.id)); if (!ex) return fail('User not found.');
    if (u.companyId && ex.companyId !== u.companyId) return fail('That user belongs to another company.');
    if (ex.fixed) { if (hash) await db.update(t.users).set({ passwordHash: hash }).where(eq(t.users.id, d.id)); await logAct(u.id, `Changed the password of ${ex.name}`); revalidatePath('/admin/users'); return done(); }
    if (ex.id === u.id && (d.role !== 'admin' || !d.active)) return fail('You cannot remove your own admin access.');
    await db.update(t.users).set({ name: d.name, role: d.role, email: d.email || null, username: d.username, authSso: d.authSso, authPassword: d.authPassword, active: d.active, lob: d.role === 'agent' ? d.lob : null, tlId: d.role === 'agent' ? d.tlId : null, companyId, clientId, ...(ex.email?.toLowerCase() !== (d.email || '').toLowerCase() ? { ssoTid: null, ssoOid: null, googleSub: null } : {}), ...(hash ? { passwordHash: hash } : {}) }).where(eq(t.users.id, d.id));
  } else {
    if (d.authPassword && !hash) return fail('Set a password, or turn password sign-in off.');
    await db.insert(t.users).values({ id: uid('u'), name: d.name, role: d.role, email: d.email || null, username: d.username, passwordHash: hash || null, authSso: d.authSso, authPassword: d.authPassword, active: d.active, lob: d.role === 'agent' ? d.lob : null, tlId: d.role === 'agent' ? d.tlId : null, companyId, clientId });
  }
  await logAct(u.id, `${d.id ? 'Updated' : 'Added'} user ${d.name} (${d.role})`);
  revalidatePath('/admin/users'); return done();
}

const allowed = ['sso', 'notify', 'feedbackTargets', 'bp'] as const;
export async function saveSettings(key: (typeof allowed)[number], value: unknown): Promise<Result> {
  const u = await requireUser(key === 'bp' ? 'bp.approve' : 'admin.settings');
  if (!allowed.includes(key)) return fail('Unknown setting.');
  if (key === 'sso' && u.companyId) return fail('Only group admins can change sign-in settings.');
  if (key === 'feedbackTargets') { const v = value as Record<string, number>; if (['deliverH', 'disputeH', 'ackH'].some((k) => !(+v[k] > 0))) return fail('Hours must be positive.'); }
  await setSetting(key, value); await logAct(u.id, `Updated ${key} settings`); revalidatePath('/admin'); return done();
}

/* ---------- hierarchy: Company › Client › Customer › LOB › Product ---------- */
const nameZ = z.string().trim().min(1).max(80);
const listZ = z.array(z.string().trim().toLowerCase().max(120)).max(20);
export async function addCompany(name: string): Promise<Result> {
  const u = await requireUser('admin.settings'); if (u.companyId) return fail('Only group admins can add a company.');
  const n = nameZ.safeParse(name); if (!n.success) return fail('Enter a company name.');
  const ex = await db.select().from(t.companies); if (ex.some((c) => c.name.toLowerCase() === n.data.toLowerCase())) return fail('That company already exists.');
  await db.insert(t.companies).values({ id: uid('co'), name: n.data }); await logAct(u.id, `Added company ${n.data}`); revalidatePath('/admin/masters'); return done();
}
export async function addClient(companyId: string, name: string): Promise<Result> {
  const u = await requireUser('admin.settings'); if (u.companyId && u.companyId !== companyId) return fail('You can add clients only to your own company.');
  const n = nameZ.safeParse(name); if (!n.success) return fail('Enter a client name.');
  const [co] = await db.select().from(t.companies).where(eq(t.companies.id, companyId)); if (!co) return fail('Pick a company.');
  const ex = await db.select().from(t.clients); if (ex.some((c) => c.name.toUpperCase() === n.data.toUpperCase())) return fail('That client already exists.');
  await db.insert(t.clients).values({ id: uid('cl'), companyId, name: n.data.toUpperCase() }); await logAct(u.id, `Added client ${n.data.toUpperCase()} under ${co.name}`); revalidatePath('/admin/masters'); return done();
}
const ClientSsoZ = z.object({ ssoDomains: listZ, ssoTenantIds: listZ, autoProvision: z.boolean(), active: z.boolean() });
export async function updateClient(id: string, input: z.input<typeof ClientSsoZ>): Promise<Result> {
  const u = await requireUser('admin.settings');
  const p = ClientSsoZ.safeParse(input); if (!p.success) return fail(zErr(p.error));
  const [cl] = await db.select().from(t.clients).where(eq(t.clients.id, id)); if (!cl) return fail('Client not found.');
  if (u.companyId && cl.companyId !== u.companyId) return fail('That client belongs to another company.');
  const doms = p.data.ssoDomains.filter(Boolean);
  if (doms.some((d) => !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d))) return fail('Enter domains like customer-capital.com.');
  const staff = ((await db.select().from(t.settings).where(eq(t.settings.key, 'sso')))[0]?.value as { domains?: string } | undefined)?.domains || '';
  const clash = doms.filter((d) => staff.toLowerCase().split(',').map((x) => x.trim()).includes(d)); if (clash.length) return fail(`${clash.join(', ')} is a staff domain and cannot be a client domain.`);
  const others = (await db.select().from(t.clients)).filter((c) => c.id !== id).flatMap((c) => c.ssoDomains.map((d) => [d, c.name] as const));
  const taken = doms.map((d) => others.find((o) => o[0] === d)).filter(Boolean); if (taken.length) return fail(`${taken[0]![0]} is already used by ${taken[0]![1]}.`);
  if (p.data.ssoTenantIds.some((x) => x && !/^[0-9a-f-]{36}$/.test(x))) return fail('Tenant IDs are GUIDs like 72f988bf-86f1-41af-91ab-2d7cd011db47.');
  await db.update(t.clients).set({ ...p.data, ssoDomains: doms, ssoTenantIds: p.data.ssoTenantIds.filter(Boolean) }).where(eq(t.clients.id, id));
  await logAct(u.id, `Updated sign-in settings for client ${cl.name}`); revalidatePath('/admin/masters'); return done();
}
async function clientInScope(clientId: string) {
  const u = await requireUser('admin.settings'); const [cl] = await db.select().from(t.clients).where(eq(t.clients.id, clientId));
  if (!cl || (u.companyId && cl.companyId !== u.companyId)) return null; return { u, cl };
}
export async function addCustomer(clientId: string, name: string): Promise<Result> {
  const c = await clientInScope(clientId); if (!c) return fail('Pick one of your clients.');
  const n = name.trim().toUpperCase(); if (!n) return fail('Enter a customer name.');
  const ex = await db.select().from(t.customers).where(and(eq(t.customers.name, n), eq(t.customers.clientId, clientId))); if (ex.length) return fail(`${n} is already a customer of ${c.cl.name}.`);
  await db.insert(t.customers).values({ id: uid('cu'), clientId, name: n }); await logAct(c.u.id, `Added customer ${n} under ${c.cl.name}`); revalidatePath('/admin/masters'); return done();
}
export async function toggleCustomer(id: string, active: boolean): Promise<Result> {
  const [cu] = await db.select().from(t.customers).where(eq(t.customers.id, id)); if (!cu || !(await clientInScope(cu.clientId))) return fail('Not found.');
  await db.update(t.customers).set({ active }).where(eq(t.customers.id, id)); revalidatePath('/admin/masters'); return done();
}
export async function addLob(clientId: string, name: string): Promise<Result> {
  const c = await clientInScope(clientId); if (!c) return fail('Pick one of your clients.');
  const n = name.trim(); if (!n) return fail('Enter an LOB name.');
  const ex = await db.select().from(t.lobs).where(eq(t.lobs.name, n)); if (ex.length) return fail('That LOB name is already used.');
  await db.insert(t.lobs).values({ name: n, clientId }); await logAct(c.u.id, `Added LOB ${n} under ${c.cl.name}`); revalidatePath('/admin/masters'); return done();
}
export async function addProduct(lob: string, name: string): Promise<Result> {
  const [l] = await db.select().from(t.lobs).where(eq(t.lobs.name, lob)); if (!l || !l.clientId || !(await clientInScope(l.clientId))) return fail('Pick one of your LOBs.');
  if (!name.trim()) return fail('Enter a product.');
  const ex = await db.select().from(t.products).where(and(eq(t.products.lob, lob), eq(t.products.name, name.trim()))); if (ex.length) return fail('That product already exists.');
  await db.insert(t.products).values({ id: uid('pr'), lob, name: name.trim() }); revalidatePath('/admin/masters'); return done();
}

/* ---------- form builder: edits are saved as a new version (old audits keep their version) ---------- */
const PZ = z.object({ code: z.string().min(1).max(20), name: z.string().trim().min(1).max(200), description: z.string().max(2000), weight: z.number().min(0).max(100), fatal: z.boolean(), options: z.array(z.enum(['Y', 'N', 'NA'])).min(2), guideY: z.string().max(1000), guideN: z.string().max(1000), guideNA: z.string().max(1000) });
const FormZ = z.object({ baseId: z.string(), name: z.string().trim().min(2).max(100), lobs: z.array(z.string()).min(1, 'Map the form to at least one LOB'), sections: z.array(z.object({ name: z.string().trim().min(1).max(120), params: z.array(PZ).min(1) })).min(1), activate: z.boolean() });
export async function saveFormVersion(input: z.input<typeof FormZ>): Promise<Result<{ id: string }>> {
  const u = await requireUser('admin.forms');
  const p = FormZ.safeParse(input); if (!p.success) return fail(zErr(p.error));
  const d = p.data; const base = await getForm(d.baseId); if (!base) return fail('Form not found.');
  const total = d.sections.reduce((s, x) => s + x.params.reduce((a, q) => a + q.weight, 0), 0);
  if (Math.abs(total - 100) > 0.001) return fail(`Marks add up to ${total}; they must total 100.`);
  const codes = d.sections.flatMap((s) => s.params.map((q) => q.code)); if (new Set(codes).size !== codes.length) return fail('Parameter codes must be unique.');
  const versions = await db.select().from(t.forms).where(eq(t.forms.family, base.family));
  const id = uid('f'), version = Math.max(...versions.map((v) => v.version)) + 1;
  await db.transaction(async (tx) => {
    await tx.insert(t.forms).values({ id, family: base.family, name: d.name, channel: base.channel, lobs: d.lobs, version, status: d.activate ? 'Active' : 'Draft' });
    for (const [si, s] of d.sections.entries()) {
      const sid = uid('s'); await tx.insert(t.sections).values({ id: sid, formId: id, ord: si, name: s.name });
      await tx.insert(t.params).values(s.params.map((q, pi) => ({ id: `${id}_${q.code}`, formId: id, sectionId: sid, ord: pi, ...q })));
    }
    if (d.activate) await tx.update(t.forms).set({ status: 'Retired' }).where(and(eq(t.forms.family, base.family), ne(t.forms.id, id), eq(t.forms.status, 'Active')));
  });
  await logAct(u.id, `Saved ${d.name} v${version}${d.activate ? ' and made it active' : ' as draft'}`);
  revalidatePath('/admin/forms'); return done({ id });
}
export async function setFormStatus(id: string, status: 'Active' | 'Retired'): Promise<Result> {
  const u = await requireUser('admin.forms'); const f = await getForm(id); if (!f) return fail('Form not found.');
  if (status === 'Active') await db.update(t.forms).set({ status: 'Retired' }).where(and(eq(t.forms.family, f.family), eq(t.forms.status, 'Active')));
  await db.update(t.forms).set({ status }).where(eq(t.forms.id, id));
  await logAct(u.id, `${status === 'Active' ? 'Activated' : 'Retired'} ${f.name} v${f.version}`); revalidatePath('/admin/forms'); return done();
}
