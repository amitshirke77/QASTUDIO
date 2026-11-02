import { db, schema as t } from '@/db';
import { requireUser } from '@/lib/auth';
import { hierarchy } from '@/lib/scope';
import { isMultiTenant } from '@/lib/sso';
import { PageHead } from '@/components/ui';
import { Masters } from './Masters';
export default async function M() {
  const u = await requireUser('admin.settings');
  const h = await hierarchy(u); const ids = new Set(h.clients.map((c) => c.id));
  const [cu, lobs, p, users] = await Promise.all([db.select().from(t.customers), db.select().from(t.lobs), db.select().from(t.products), db.select({ role: t.users.role, clientId: t.users.clientId }).from(t.users)]);
  const myLobs = lobs.filter((l) => l.clientId && ids.has(l.clientId));
  return <><PageHead title="Master data" sub="Companies, their clients, each client's customers, LOBs and products, and how each client's stakeholders sign in." />
    <Masters companies={h.companies.map((c) => ({ id: c.id, name: c.name }))} clients={h.clients.map((c) => ({ ...c, users: users.filter((x) => x.role === 'client' && x.clientId === c.id).length }))} customers={cu.filter((c) => ids.has(c.clientId)).sort((a, b) => a.name.localeCompare(b.name))} lobs={myLobs} products={p.filter((x) => myLobs.some((l) => l.name === x.lob))} groupAdmin={!u.companyId} multiTenant={isMultiTenant()} /></>;
}
