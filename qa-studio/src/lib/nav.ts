import type { Role } from './rbac';
export type NavItem = { href: string; label: string; badge?: string };
export function navFor(r: Role): [string, NavItem[]][] {
  const Q: NavItem[] = [], A: NavItem[] = [], R: NavItem[] = [];
  const q = (href: string, label: string, badge?: string) => Q.push({ href, label, badge });
  if (r === 'admin' || r === 'qalead') { q('/dashboard', 'Dashboard'); q('/trends', 'Trends'); q('/reports', 'Reports'); q('/audits', 'Audits'); q('/allocations', 'Allocations'); q('/targets', 'Audit targets'); q('/plan', 'Plan adherence'); q('/audits/new', 'New audit'); q('/disputes', 'Disputes', 'disputes'); q('/tracker', 'Feedback tracker', 'tracker'); q('/learning', 'Learning'); q('/calibration', 'Calibration'); }
  if (r === 'manager') { q('/dashboard', 'Dashboard'); q('/trends', 'Trends'); q('/reports', 'Reports'); q('/audits', 'Audits'); q('/targets', 'Audit targets'); q('/plan', 'Plan adherence'); q('/tracker', 'Feedback tracker', 'tracker'); q('/learning', 'Learning'); q('/calibration', 'Calibration'); }
  if (r === 'auditor') { q('/queue', 'My queue', 'queue'); q('/plan', 'My plan'); q('/audits/new', 'New audit'); q('/audits', 'My audits'); q('/disputes', 'Disputes', 'disputes'); q('/tracker', 'Feedback tracker', 'tracker'); q('/learning', 'Learning'); q('/calibration', 'Calibration', 'calib'); q('/dashboard', 'Dashboard'); q('/trends', 'Trends'); q('/reports', 'Reports'); }
  if (r === 'tl') { q('/team', 'My team'); q('/audits/new', 'New audit'); q('/audits', 'Team audits'); q('/tracker', 'Feedback tracker', 'tracker'); q('/learning', 'Learning'); q('/dashboard', 'Dashboard'); q('/trends', 'Trends'); q('/reports', 'Reports'); }
  if (r === 'agent') { q('/me', 'My workspace'); q('/me/learning', 'My learning', 'mylearning'); q('/trends', 'My trends'); }
  if (r === 'client') { q('/dashboard', 'Dashboard'); q('/trends', 'Trends'); q('/reports', 'Reports'); q('/audits', 'Audits'); }
  if (r === 'admin') ['/admin/users|Users', '/admin/roles|Roles & permissions', '/admin/forms|Forms', '/admin/import|Import past audits', '/admin/masters|Master data', '/admin/login|Login & SSO', '/admin/notifications|Notifications', '/admin/best-practices|Best practices', '/admin/log|Activity log'].forEach((x) => { const [h, l] = x.split('|'); A.push({ href: h, label: l }); });
  if (r === 'qalead') ['/admin/forms|Forms', '/admin/import|Import past audits', '/admin/best-practices|Best practices'].forEach((x) => { const [h, l] = x.split('|'); A.push({ href: h, label: l }); });
  R.push({ href: '/legend', label: 'Evaluation legend' }, { href: '/help', label: 'Help' });
  return ([['Quality', Q], ['Admin', A], ['Reference', R]] as [string, NavItem[]][]).filter((g) => g[1].length);
}
