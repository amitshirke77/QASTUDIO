import { and, eq } from 'drizzle-orm';
import { db, schema as t } from '@/db';
import { requireUser } from '@/lib/auth';
import { activeForms, getSetting, getUsers } from '@/lib/data';
import { adherenceFor } from '@/lib/plan';
import { PageHead } from '@/components/ui';
import AuditForm from './AuditForm';
import { scopedCustomers, scopedUserIds } from '@/lib/scope';

export default async function NewAudit({ searchParams }: { searchParams: { alloc?: string; agent?: string; customer?: string; product?: string; channel?: string } }) {
  const u = await requireUser('audit.create');
  const users = await getUsers(); const ids = await scopedUserIds(u); const vis = (id: string) => !ids || ids.has(id);
  const agents = users.filter((x) => x.role === 'agent' && x.active && vis(x.id) && (u.role !== 'tl' || x.tlId === u.id)).map((x) => ({ id: x.id, name: x.name, lob: x.lob || 'Tripstacc', tlId: x.tlId || '', clientId: x.clientId || '' }));
  const qas = users.filter((x) => x.active && (vis(x.id) || !x.companyId) && (['auditor', 'qalead', 'admin'].includes(x.role) || (u.role === 'tl' && x.id === u.id))).map((x) => ({ id: x.id, name: x.name }));
  const tls = users.filter((x) => x.role === 'tl' && x.active && vis(x.id)).map((x) => ({ id: x.id, name: x.name }));
  const forms = (await activeForms()).map((f) => ({ id: f.id, name: f.name, version: f.version, channel: f.channel, lobs: f.lobs, sections: f.sections.map((s) => ({ id: s.id, name: s.name, params: s.params.map((p) => ({ id: p.id, name: p.name, description: p.description, weight: p.weight, fatal: p.fatal, options: p.options, guideY: p.guideY, guideN: p.guideN, guideNA: p.guideNA })) })) }));
  const customerRows = await scopedCustomers(u); const customers = [...new Set(customerRows.map((c) => c.name))];
  const customersByClient: Record<string, string[]> = {}; customerRows.forEach((c) => (customersByClient[c.clientId] = [...(customersByClient[c.clientId] || []), c.name]));
  const products: Record<string, string[]> = {}; (await db.select().from(t.products)).forEach((p) => (products[p.lob] = [...(products[p.lob] || []), p.name]));
  const alloc = searchParams.alloc ? (await db.select().from(t.allocations).where(and(eq(t.allocations.id, searchParams.alloc), eq(t.allocations.status, 'Pending'))))[0] : undefined;
  const bp = await getSetting<Record<string, { status: string }>>('bp', {});
  const adh = await adherenceFor(u.id);
  const fit = adh ? { period: adh.period === 'Monthly' ? 'this month' : 'this week', lines: Object.fromEntries(adh.byLine.map((r) => [r.key, { plan: r.plan, done: r.done }])), agents: Object.fromEntries(adh.agentRows.map((a) => [a.id, { pc: a.planCalls, pe: a.planEmails, dc: a.doneCalls, de: a.doneEmails }])), top: adh.suggestions.slice(0, 2).map((x) => ({ agentId: x.agentId, agentName: x.agentName, customer: x.customer, product: x.product, channel: x.channel })) } : null;
  const ch = searchParams.channel === 'Email' ? 'Email' : searchParams.channel === 'Call' ? 'Call' : undefined;
  const prefill = searchParams.agent && agents.some((a) => a.id === searchParams.agent) ? { agentId: searchParams.agent, customer: customers.includes(searchParams.customer || '') ? searchParams.customer! : '', product: searchParams.product || '', channel: ch } : null;
  return (<>
    <PageHead eyebrow={alloc ? 'From your queue' : 'Ad-hoc audit'} title="New audit" sub={u.role === 'tl' ? 'Team Leaders can audit only the agents mapped to them. Rate each parameter, then add observations and areas of improvement.' : 'Fill the details, rate each parameter, then add observations and areas of improvement. Scores update as you go.'} />
    {forms.length ? <AuditForm me={{ id: u.id, role: u.role }} agents={agents} qas={qas} tls={tls} forms={forms} customers={customers} customersByClient={customersByClient} products={products} aoiForN={bp.aoiForN?.status === 'approved'} alloc={alloc ? { id: alloc.id, agentId: alloc.agentId, channel: alloc.channel } : null} fit={fit} prefill={prefill} />
      : <div className="card empty">No active form. Activate one under Admin › Forms.</div>}
  </>);
}
