import { fdate } from './dates';
import { weekOptions, type UserRow } from './data';
import type { SessionUser } from './rbac';
import { hierarchy, scopedCustomers, scopedLobs, scopedUserIds } from './scope';
/** Slicer options limited to the user's scope (their company's or client's agents, auditors and customers). */
export async function filterOptions(u: SessionUser, users: UserRow[]) {
  const [cu, ids, h, lobs] = await Promise.all([scopedCustomers(u), scopedUserIds(u), hierarchy(u), scopedLobs(u)]);
  const vis = (x: UserRow) => !ids || ids.has(x.id) || (!x.companyId && x.role !== 'agent');
  return {
    agents: users.filter((x) => x.role === 'agent' && vis(x) && (u.role !== 'tl' || x.tlId === u.id)).map((x) => [x.id, x.name] as [string, string]),
    auditors: users.filter((x) => ['auditor', 'qalead', 'admin', 'tl'].includes(x.role) && vis(x)).map((x) => [x.id, x.name] as [string, string]),
    clients: h.clients.map((c) => [c.id, `${c.name} · ${h.companies.find((x) => x.id === c.companyId)?.name || ''}`] as [string, string]), lobs,
    customers: [...new Set(cu.map((c) => c.name))], weeks: weekOptions().map((w) => [w, 'WE ' + fdate(w)] as [string, string]), hideAgent: u.role === 'agent',
  };
}
