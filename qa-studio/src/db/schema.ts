import {
  pgTable, text, boolean, integer, real, timestamp, date, jsonb, primaryKey, index, uniqueIndex, customType,
} from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array }>({ dataType: () => 'bytea', fromDriver: (v) => Buffer.from(v as Uint8Array) });

/* Roles: admin · manager · qalead · auditor (QA Auditor) · tl (Team Leader) · agent · client */
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  email: text('email'),
  username: text('username').notNull(),
  passwordHash: text('password_hash'),
  authSso: boolean('auth_sso').notNull().default(true),
  authPassword: boolean('auth_password').notNull().default(true),
  active: boolean('active').notNull().default(true),
  lob: text('lob'), // Tripstacc | Shopstacc (agents)
  tlId: text('tl_id'), // agent -> team leader
  fixed: boolean('fixed').notNull().default(false), // built-in logins that cannot be deleted
  companyId: text('company_id'), // staff and agents: their company; null = group-wide (sees every company)
  clientId: text('client_id'), // client stakeholders: the client they belong to; agents: the client program they work on
  ssoTid: text('sso_tid'), // Microsoft Entra tenant and object ID, linked on first Microsoft 365 sign-in
  ssoOid: text('sso_oid'),
  googleSub: text('google_sub'), // Google account subject ID, linked on first Google sign-in
  importBatchId: text('import_batch_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  username: uniqueIndex('users_username').on(t.username),
  email: index('users_email').on(t.email),
  tl: index('users_tl').on(t.tlId),
  sso: index('users_sso').on(t.ssoTid, t.ssoOid),
  google: index('users_google').on(t.googleSub),
}));

/* Hierarchy: Company (PeopleOCity, Expenova) › Client (CUSTCAP, UPPERCASE) › Customer (IDFCFIRST, AMEX…) › LOB › Product */
export const companies = pgTable('companies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  active: boolean('active').notNull().default(true),
});

export const clients = pgTable('clients', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  name: text('name').notNull(),
  ssoDomains: text('sso_domains').array().notNull().default([]), // e.g. customer-capital.com: stakeholders who may sign in with Microsoft 365
  ssoTenantIds: text('sso_tenant_ids').array().notNull().default([]), // the client's Entra tenant ID(s) when it signs in from its own tenant
  autoProvision: boolean('auto_provision').notNull().default(false), // create a read-only client login on first Microsoft 365 sign-in
  active: boolean('active').notNull().default(true),
}, (t) => ({ company: index('clients_company').on(t.companyId) }));

export const customers = pgTable('customers', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull(),
  name: text('name').notNull(),
  active: boolean('active').notNull().default(true),
}, (t) => ({ client: index('customers_client').on(t.clientId) }));

export const lobs = pgTable('lobs', { name: text('name').primaryKey(), clientId: text('client_id') });

export const products = pgTable('products', {
  id: text('id').primaryKey(),
  lob: text('lob').notNull(),
  name: text('name').notNull(),
});

export const forms = pgTable('forms', {
  id: text('id').primaryKey(),
  family: text('family').notNull(),
  name: text('name').notNull(),
  channel: text('channel').notNull(), // Call | Email
  lobs: text('lobs').array().notNull(),
  version: integer('version').notNull().default(1),
  status: text('status').notNull().default('Active'), // Draft | Active | Retired
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sections = pgTable('sections', {
  id: text('id').primaryKey(),
  formId: text('form_id').notNull(),
  ord: integer('ord').notNull(),
  name: text('name').notNull(),
});

export const params = pgTable('params', {
  id: text('id').primaryKey(),
  formId: text('form_id').notNull(),
  sectionId: text('section_id').notNull(),
  ord: integer('ord').notNull(),
  code: text('code').notNull(), // stable key across versions, e.g. c6
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  weight: real('weight').notNull(),
  fatal: boolean('fatal').notNull().default(false),
  options: text('options').array().notNull(),
  guideY: text('guide_y').notNull().default(''),
  guideN: text('guide_n').notNull().default(''),
  guideNA: text('guide_na').notNull().default(''),
}, (t) => ({ form: index('params_form').on(t.formId) }));

export const audits = pgTable('audits', {
  id: text('id').primaryKey(),
  caseId: text('case_id').notNull(),
  agentId: text('agent_id').notNull(),
  auditorId: text('auditor_id').notNull(),
  tlId: text('tl_id').notNull(),
  formId: text('form_id').notNull(),
  channel: text('channel').notNull(),
  lob: text('lob').notNull(),
  product: text('product').notNull(),
  customer: text('customer').notNull(),
  clientId: text('client_id').notNull(),
  auditDate: date('audit_date').notNull(),
  weekEnding: date('week_ending').notNull(),
  month: text('month').notNull(),
  interactionDate: date('interaction_date').notNull(),
  phone: text('phone'),
  link: text('link'),
  observations: text('observations').notNull().default(''),
  overall: real('overall').notNull(),
  actual: real('actual').notNull(),
  fatal: boolean('fatal').notNull(),
  // Pending acknowledgement | Acknowledged | Disputed | Dispute resolved
  status: text('status').notNull().default('Pending acknowledgement'),
  allocationId: text('allocation_id'),
  importBatchId: text('import_batch_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  agent: index('audits_agent').on(t.agentId),
  auditor: index('audits_auditor').on(t.auditorId),
  date: index('audits_date').on(t.auditDate),
  tl: index('audits_tl').on(t.tlId),
}));

export const answers = pgTable('answers', {
  auditId: text('audit_id').notNull(),
  paramId: text('param_id').notNull(),
  value: text('value').notNull(), // Y | N | NA
}, (t) => ({ pk: primaryKey({ columns: [t.auditId, t.paramId] }) }));

export const aois = pgTable('aois', {
  id: text('id').primaryKey(),
  auditId: text('audit_id').notNull(),
  paramId: text('param_id'),
  text: text('text').notNull(),
}, (t) => ({ audit: index('aois_audit').on(t.auditId) }));

export const acknowledgements = pgTable('acknowledgements', {
  auditId: text('audit_id').primaryKey(),
  at: timestamp('at', { withTimezone: true }).notNull(),
  auto: boolean('auto').notNull().default(false),
  suggestion: text('suggestion').notNull().default(''),
});

export const disputes = pgTable('disputes', {
  id: text('id').primaryKey(),
  auditId: text('audit_id').notNull(),
  paramIds: text('param_ids').array().notNull(),
  reason: text('reason').notNull(),
  raisedAt: timestamp('raised_at', { withTimezone: true }).notNull(),
  outcome: text('outcome'), // Upheld | Rejected | Partially upheld
  note: text('note'),
  resolvedBy: text('resolved_by'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
}, (t) => ({ audit: index('disputes_audit').on(t.auditId) }));

export const allocations = pgTable('allocations', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull(),
  auditorId: text('auditor_id').notNull(),
  channel: text('channel').notNull(),
  dueDate: date('due_date').notNull(),
  status: text('status').notNull().default('Pending'), // Pending | Done | Cancelled
  note: text('note').notNull().default(''),
  auditId: text('audit_id'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const feedbackSessions = pgTable('feedback_sessions', {
  id: text('id').primaryKey(),
  auditId: text('audit_id').notNull(),
  at: timestamp('at', { withTimezone: true }).notNull(),
  by: text('by').notNull(),
  mode: text('mode').notNull(), // One-to-one | Huddle | Teams call | Floor
  note: text('note').notNull().default(''),
});

export const reminders = pgTable('reminders', {
  id: text('id').primaryKey(),
  auditId: text('audit_id').notNull(),
  at: timestamp('at', { withTimezone: true }).notNull(),
  by: text('by').notNull(),
  toUserId: text('to_user_id').notNull(),
});

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  text: text('text').notNull(),
  link: text('link'), // app path, e.g. /audits/AU123
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ user: index('notifications_user').on(t.userId, t.read) }));

export const outbox = pgTable('outbox', {
  id: text('id').primaryKey(),
  channel: text('channel').notNull(), // email | teams
  to: text('to').notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  status: text('status').notNull().default('Queued'), // Queued | Sent | Failed
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
});

export type Audience = { kind: 'all' | 'lob' | 'team' | 'agents' | 'missed'; value?: string; agents?: string[]; params?: string[]; days?: number };
export type QuizQuestion = {
  id: string; type: 'single' | 'multi' | 'tf' | 'short' | 'long' | 'rating'; text: string; required: boolean; points: number;
  options: { id: string; text: string; correct: boolean }[]; accepted?: string;
};
export type Quiz = { enabled: boolean; passPct: number; attempts: number; showAnswers: boolean; questions: QuizQuestion[] };

export const learningItems = pgTable('learning_items', {
  id: text('id').primaryKey(),
  type: text('type').notNull(), // JIT | Briefing
  title: text('title').notNull(),
  body: text('body').notNull(),
  params: text('params').array().notNull(), // param codes
  audience: jsonb('audience').$type<Audience>().notNull(),
  due: date('due'),
  status: text('status').notNull().default('Draft'), // Draft | Published | Archived
  quiz: jsonb('quiz').$type<Quiz | null>(),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
});

/** Files attached to a JIT training or briefing note. itemId is null until the item is saved. */
export const learningFiles = pgTable('learning_files', {
  id: text('id').primaryKey(),
  itemId: text('item_id'),
  name: text('name').notNull(),
  type: text('type').notNull(),
  size: integer('size').notNull(),
  data: bytea('data').notNull(),
  uploadedBy: text('uploaded_by').notNull(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ item: index('learning_files_item').on(t.itemId) }));

export const learningAssignments = pgTable('learning_assignments', {
  itemId: text('item_id').notNull(),
  agentId: text('agent_id').notNull(),
  openedAt: timestamp('opened_at', { withTimezone: true }),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  comment: text('comment').notNull().default(''),
}, (t) => ({ pk: primaryKey({ columns: [t.itemId, t.agentId] }) }));

export const quizSubmissions = pgTable('quiz_submissions', {
  id: text('id').primaryKey(),
  itemId: text('item_id').notNull(),
  agentId: text('agent_id').notNull(),
  at: timestamp('at', { withTimezone: true }).notNull(),
  answers: jsonb('answers').$type<Record<string, unknown>>().notNull(),
  auto: jsonb('auto').$type<Record<string, number | null>>().notNull(),
  manual: jsonb('manual').$type<Record<string, { points: number | null; feedback: string }>>().notNull(),
  score: real('score').notNull(),
  max: real('max').notNull(),
  pct: real('pct'),
  passed: boolean('passed'),
  status: text('status').notNull(), // Scored | Awaiting grading
  gradedBy: text('graded_by'),
  gradedAt: timestamp('graded_at', { withTimezone: true }),
}, (t) => ({ item: index('quiz_item').on(t.itemId) }));

export const calibSessions = pgTable('calib_sessions', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  formId: text('form_id').notNull(),
  due: date('due'),
  status: text('status').notNull().default('Open'), // Open | Closed
  participants: text('participants').array().notNull(),
  outcome: text('outcome').notNull().default(''),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
});

export const calibItems = pgTable('calib_items', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  ord: integer('ord').notNull(),
  auditId: text('audit_id'),
  caseId: text('case_id').notNull(),
  link: text('link'),
});

export const calibScores = pgTable('calib_scores', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  itemId: text('item_id').notNull(),
  userId: text('user_id').notNull(),
  answers: jsonb('answers').$type<Record<string, string>>().notNull(),
  overall: real('overall').notNull(),
  actual: real('actual').notNull(),
  fatal: boolean('fatal').notNull(),
  note: text('note').notNull().default(''),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull(),
}, (t) => ({ uniq: uniqueIndex('calib_scores_uniq').on(t.itemId, t.userId) }));

export const calibAgreed = pgTable('calib_agreed', {
  sessionId: text('session_id').notNull(),
  itemId: text('item_id').notNull(),
  paramId: text('param_id').notNull(),
  value: text('value').notNull(),
  note: text('note').notNull().default(''),
}, (t) => ({ pk: primaryKey({ columns: [t.itemId, t.paramId] }) }));

export const volumes = pgTable('volumes', {
  id: text('id').primaryKey(),
  customer: text('customer').notNull(),
  lob: text('lob').notNull(),
  product: text('product').notNull(),
  channel: text('channel').notNull(),
  month: text('month').notNull(), // YYYY-MM
  count: integer('count').notNull(),
});

export const planLines = pgTable('plan_lines', {
  id: text('id').primaryKey(),
  customer: text('customer').notNull(),
  lob: text('lob').notNull(),
  product: text('product').notNull(),
  channel: text('channel').notNull(),
  projected: integer('projected'), // monthly volume for new lines
  goLive: date('go_live'),
  isNew: boolean('is_new').notNull().default(false),
  rate: real('rate'), // % sampling override for the line
  override: integer('override'), // fixed monthly audit count
  active: boolean('active').notNull().default(true),
});

export const auditorTargets = pgTable('auditor_targets', {
  userId: text('user_id').primaryKey(),
  period: text('period').notNull().default('Weekly'), // Weekly | Monthly
  share: real('share').notNull().default(1), // relative share of capacity
  lobs: text('lobs').array().notNull(),
  overrideCalls: integer('override_calls'),
  overrideEmails: integer('override_emails'),
});

export const importBatches = pgTable('import_batches', {
  id: text('id').primaryKey(),
  file: text('file').notNull(),
  formId: text('form_id').notNull(),
  importedBy: text('imported_by').notNull(),
  at: timestamp('at', { withTimezone: true }).notNull(),
  count: integer('count').notNull(),
  skipped: integer('skipped').notNull(),
});

export const customReports = pgTable('custom_reports', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  purpose: text('purpose').notNull().default(''),
  cols: text('cols').notNull().default(''),
  filters: text('filters').notNull().default(''),
  audience: text('audience').notNull().default(''),
  freq: text('freq').notNull().default('Monthly'),
  status: text('status').notNull().default('Awaiting format'),
  by: text('by').notNull(),
  at: date('at').notNull(),
});

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
});

export const activityLog = pgTable('activity_log', {
  id: text('id').primaryKey(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  userId: text('user_id'),
  text: text('text').notNull(),
});
