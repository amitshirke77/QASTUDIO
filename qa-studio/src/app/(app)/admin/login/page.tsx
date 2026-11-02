import { requireUser, ssoEnabled, googleEnabled } from '@/lib/auth';
import { getSetting } from '@/lib/data';
import { hierarchy } from '@/lib/scope';
import { isMultiTenant } from '@/lib/sso';
import { PageHead } from '@/components/ui';
import { SsoForm } from '../Settings';
export default async function L() {
  const u = await requireUser('admin.settings'); const h = await hierarchy(u);
  const v = await getSetting('sso', { domains: 'zipstacc.com', tenantIds: '', allowManual: true, groups: [] as { g: string; role: string; companyId?: string | null }[] });
  return <><PageHead title="Login & SSO" sub="Single sign-in with Microsoft 365 (Entra ID) or Google Workspace for staff (zipstacc.com) and for each client's stakeholders (their own domain), plus username and password." />
    <SsoForm v={v} configured={ssoEnabled} google={googleEnabled} multiTenant={isMultiTenant()} companies={h.companies.map((c) => ({ id: c.id, name: c.name }))} clients={h.clients.map((c) => ({ name: c.name, companyId: c.companyId, company: h.companies.find((x) => x.id === c.companyId)?.name || '', ssoDomains: c.ssoDomains, ssoTenantIds: c.ssoTenantIds }))} /></>;
}
