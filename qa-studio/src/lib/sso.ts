/**
 * Microsoft 365 (Entra ID) sign-in rules. Pure functions, unit-tested in tests/sso.test.ts.
 *
 * Two ways to let a client's people sign in:
 *  1. Guests: invite them into the zipstacc tenant as B2B guests and keep AZURE_AD_TENANT_ID = the zipstacc tenant ID.
 *     Only that tenant can sign in, so domains are checked but tenant IDs are not needed.
 *  2. Their own tenant: register the app as multi-tenant and set AZURE_AD_TENANT_ID=organizations.
 *     Then every organization (staff and each client) must list its tenant ID(s); a sign-in from any other tenant is refused,
 *     because in multi-tenant mode an email domain alone is not proof of who someone is.
 */
export type StaffCfg = { domains: string[]; tenantIds: string[] };
export type ClientCfg = { id: string; companyId: string; name: string; active: boolean; ssoDomains: string[]; ssoTenantIds: string[]; autoProvision: boolean };
export type Claims = { tid?: string; oid?: string; upn?: string; email?: string };
export type Org = { kind: 'staff' } | { kind: 'client'; clientId: string; companyId: string; autoProvision: boolean };
export type Match = { ok: true; org: Org; email: string } | { ok: false; error: 'NoEmail' | 'Domain' | 'Tenant' | 'Unverified' | 'GoogleWorkspace' };

export const isMultiTenant = (tenant = process.env.AZURE_AD_TENANT_ID || '') => ['organizations', 'common'].includes(tenant.toLowerCase());
export const list = (v: string | string[] | undefined | null) => (Array.isArray(v) ? v : String(v || '').split(',')).map((x) => x.trim().toLowerCase()).filter(Boolean);
const domainOf = (e: string) => e.split('@')[1] || '';

export function matchOrg(c: Claims, staff: StaffCfg, clients: ClientCfg[], multiTenant: boolean): Match {
  const emails = [...new Set([c.upn, c.email].map((x) => String(x || '').trim().toLowerCase()).filter((x) => x.includes('@') && !x.includes('#ext#')))];
  if (!emails.length) return { ok: false, error: 'NoEmail' };
  const tid = String(c.tid || '').toLowerCase();
  const tenantOk = (ids: string[]) => !multiTenant || (!!tid && list(ids).includes(tid));
  for (const e of emails) {
    if (list(staff.domains).includes(domainOf(e))) return tenantOk(staff.tenantIds) ? { ok: true, org: { kind: 'staff' }, email: e } : { ok: false, error: 'Tenant' };
  }
  for (const e of emails) {
    const cl = clients.find((x) => x.active && list(x.ssoDomains).includes(domainOf(e)));
    if (cl) return tenantOk(cl.ssoTenantIds) ? { ok: true, org: { kind: 'client', clientId: cl.id, companyId: cl.companyId, autoProvision: cl.autoProvision }, email: e } : { ok: false, error: 'Tenant' };
  }
  return { ok: false, error: 'Domain' };
}

/** An existing account must belong to the organization the sign-in came from. */
export function accountFits(u: { role: string; clientId: string | null }, org: Org) {
  return org.kind === 'client' ? u.role === 'client' && u.clientId === org.clientId : u.role !== 'client';
}

/**
 * Google sign-in. Only Google Workspace accounts of a configured domain are accepted: the email must be verified and
 * Google's hosted-domain claim (hd) must equal the email's domain. A personal Google account registered with a work
 * address has no hd claim, so it cannot pass as that organization.
 */
export type GoogleClaims = { email?: string; email_verified?: boolean | string; hd?: string };
export function matchGoogle(g: GoogleClaims, staff: StaffCfg, clients: ClientCfg[]): Match {
  const email = String(g.email || '').trim().toLowerCase();
  if (!email.includes('@')) return { ok: false, error: 'NoEmail' };
  if (g.email_verified !== true && g.email_verified !== 'true') return { ok: false, error: 'Unverified' };
  if (String(g.hd || '').toLowerCase() !== domainOf(email)) return { ok: false, error: 'GoogleWorkspace' };
  return matchOrg({ email }, staff, clients, false);
}
