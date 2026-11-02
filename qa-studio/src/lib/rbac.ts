export type Role = 'admin' | 'manager' | 'qalead' | 'auditor' | 'tl' | 'agent' | 'client';
export const ROLES: Record<Role, string> = {
  admin: 'Admin', manager: 'Manager', qalead: 'QA Lead', auditor: 'QA Auditor', tl: 'Team Leader', agent: 'Agent', client: 'Client stakeholder',
};
export const ROLE_KEYS = Object.keys(ROLES) as Role[];
export const STAFF: Role[] = ['admin', 'manager', 'qalead', 'auditor', 'tl'];

export type Cap =
  | 'dashboard' | 'reports' | 'reports.custom' | 'audits.list'
  | 'audit.create' | 'allocate' | 'targets.manage' | 'targets.view'
  | 'dispute.resolve' | 'feedback.log' | 'feedback.remind' | 'tracker'
  | 'learning.create' | 'learning.take' | 'quiz.grade'
  | 'calib.run' | 'calib.view' | 'calib.participate'
  | 'audit.acknowledge'
  | 'admin.users' | 'admin.forms' | 'admin.settings' | 'import' | 'bp.approve' | 'log.view';

export const CAPS: Record<Role, Cap[]> = {
  admin: ['dashboard', 'reports', 'reports.custom', 'audits.list', 'audit.create', 'allocate', 'targets.manage', 'targets.view', 'dispute.resolve', 'feedback.log', 'feedback.remind', 'tracker', 'learning.create', 'quiz.grade', 'calib.run', 'calib.view', 'admin.users', 'admin.forms', 'admin.settings', 'import', 'bp.approve', 'log.view'],
  manager: ['dashboard', 'reports', 'reports.custom', 'audits.list', 'targets.view', 'feedback.remind', 'tracker', 'learning.create', 'quiz.grade', 'calib.view'],
  qalead: ['dashboard', 'reports', 'reports.custom', 'audits.list', 'audit.create', 'allocate', 'targets.manage', 'targets.view', 'dispute.resolve', 'feedback.log', 'feedback.remind', 'tracker', 'learning.create', 'quiz.grade', 'calib.run', 'calib.view', 'admin.forms', 'import'],
  auditor: ['dashboard', 'reports', 'audits.list', 'audit.create', 'targets.view', 'dispute.resolve', 'feedback.log', 'feedback.remind', 'tracker', 'learning.create', 'quiz.grade', 'calib.participate'],
  tl: ['dashboard', 'reports', 'audits.list', 'audit.create', 'dispute.resolve', 'feedback.log', 'feedback.remind', 'tracker', 'learning.create', 'quiz.grade'],
  agent: ['learning.take', 'audit.acknowledge'],
  client: ['dashboard', 'reports', 'audits.list'],
};
export const can = (role: Role | string | undefined, cap: Cap) => !!role && (CAPS[role as Role] || []).includes(cap);

/** companyId: null = group-wide staff (sees every company). clientId: set for client stakeholders (and agents' program). */
export type SessionUser = { id: string; name: string; role: Role; lob?: string | null; tlId?: string | null; companyId?: string | null; clientId?: string | null };
type AgentLike = { id: string; role: string; tlId?: string | null; active?: boolean };
type AuditLike = { agentId: string; auditorId: string; tlId: string };

/** QA Auditors (and QA Leads, Admins) audit every agent; a Team Leader audits only agents mapped to them. */
export function canAuditAgent(u: SessionUser, agent: AgentLike | null | undefined) {
  if (!agent || agent.role !== 'agent' || agent.active === false) return false;
  if (u.role === 'admin' || u.role === 'qalead' || u.role === 'auditor') return true;
  if (u.role === 'tl') return agent.tlId === u.id;
  return false;
}
export function canViewAudit(u: SessionUser, a: AuditLike) {
  if (u.role === 'agent') return a.agentId === u.id;
  if (u.role === 'tl') return a.tlId === u.id || a.auditorId === u.id;
  return true;
}
export function canResolveDispute(u: SessionUser, a: AuditLike) {
  if (u.role === 'admin' || u.role === 'qalead') return true;
  if (u.role === 'auditor' || u.role === 'tl') return a.auditorId === u.id;
  return false;
}
export function canGradeQuiz(u: SessionUser, item: { createdBy: string }) {
  if (u.role === 'admin' || u.role === 'qalead' || u.role === 'manager') return true;
  if (u.role === 'auditor' || u.role === 'tl') return item.createdBy === u.id;
  return false;
}
export function homeFor(role: Role) {
  return ({ admin: '/dashboard', manager: '/dashboard', qalead: '/dashboard', auditor: '/queue', tl: '/team', agent: '/me', client: '/dashboard' } as const)[role];
}

/** Capability matrix shown on Admin › Roles & permissions. */
export const MATRIX: [string, ...string[]][] = [
  ['Sign in with Microsoft 365 or a password', '✓', '✓', '✓', '✓', '✓', '✓', '✓ (own domain)'],
  ['See data of', 'Own company, or all if group-wide', 'Own company, or all if group-wide', 'Own company', 'Own company', 'Own company', 'Own audits', 'Own client only'],
  ['Dashboard, Trends and Reports', 'All', 'All', 'All', 'All', 'Own team', 'Own (My workspace)', 'All, read-only'],
  ['Audit agents', 'All', '—', 'All', 'All', 'Own team only', '—', '—'],
  ['Allocate audits and set audit targets', '✓', 'View', '✓', 'View own', '—', '—', '—'],
  ['Resolve disputes', 'All', '—', 'All', 'Own audits', 'Own audits', '—', '—'],
  ['Log feedback sessions', '✓', '—', '✓', '✓', 'Own team', '—', '—'],
  ['Send feedback reminders', '✓', '✓', '✓', '✓', 'Own team', '—', '—'],
  ['Create JIT trainings, briefings and quizzes', '✓', '✓', '✓', '✓', '✓', '—', '—'],
  ['Grade quiz answers', 'All', 'All', 'All', 'Own items', 'Own items', '—', '—'],
  ['Read and accept trainings, take quizzes', '—', '—', '—', '—', '—', '✓', '—'],
  ['Run calibration sessions', '✓', 'View results', '✓', 'Take part', '—', '—', '—'],
  ['Acknowledge or dispute own audits', '—', '—', '—', '—', '—', '✓', '—'],
  ['Users, master data, login, notifications', '✓', '—', '—', '—', '—', '—', '—'],
  ['Forms and import past audits', '✓', '—', '✓', '—', '—', '—', '—'],
  ['Approve best practices', '✓', '—', 'View', '—', '—', '—', '—'],
];
