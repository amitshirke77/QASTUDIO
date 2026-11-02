/**
 * Production setup (run once, after the migrations). Creates only real master data:
 *  - companies Expenova and PeopleOCity, clients CUSTCAP (Expenova) and UPPERCASE (PeopleOCity)
 *  - CUSTCAP's customers, LOBs and products, and the call and email forms with the full evaluation legend
 *  - default settings, and your group-wide admin login
 * No sample audits, agents or demo logins are created.
 *
 *   ADMIN_EMAIL (required), ADMIN_NAME, ADMIN_PASSWORD (optional: without it the admin signs in with Microsoft 365 only)
 *   CUSTCAP_PASSWORD, UPPERCASE_PASSWORD   optional shared password logins for each client (at least 12 characters)
 *   CUSTCAP_SSO_DOMAINS (default customer-capital.com), UPPERCASE_SSO_DOMAINS  client stakeholder Microsoft 365 domains
 *   ALLOWED_EMAIL_DOMAINS (default zipstacc.com), STAFF_TENANT_IDS           staff Microsoft 365 sign-in
 */
import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import { db, schema as t } from './index';
import master from './master-data.json';

let idn = 0;
const id = (p: string) => p + (++idn).toString(36).padStart(5, '0');

async function main() {
  const existing = await db.select({ n: sql<number>`count(*)::int` }).from(t.users);
  if (existing[0].n > 0) { console.log('Database already seeded, nothing to do.'); return; }

  /* ---------- master data ---------- */
  const doms = (v: string | undefined, d: string) => (v ?? d).split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  await db.insert(t.companies).values([{ id: 'expenova', name: 'Expenova' }, { id: 'peopleocity', name: 'PeopleOCity' }]);
  await db.insert(t.clients).values([
    { id: 'custcap', companyId: 'expenova', name: 'CUSTCAP', ssoDomains: doms(process.env.CUSTCAP_SSO_DOMAINS, 'customer-capital.com') },
    { id: 'uppercase', companyId: 'peopleocity', name: 'UPPERCASE', ssoDomains: doms(process.env.UPPERCASE_SSO_DOMAINS, '') },
  ]);
  await db.insert(t.lobs).values([{ name: 'Tripstacc', clientId: 'custcap' }, { name: 'Shopstacc', clientId: 'custcap' }]);
  await db.insert(t.products).values(Object.entries(master.products).flatMap(([lob, ps]) => ps.map((name) => ({ id: id('pr'), lob, name }))));
  await db.insert(t.customers).values(master.customers.map((name) => ({ id: id('cu'), clientId: 'custcap', name })));
  const FORM_ID: Record<string, string> = { call: 'f1', email: 'f2' };
  for (const f of master.forms) {
    const fid = FORM_ID[f.key];
    await db.insert(t.forms).values({ id: fid, family: fid, name: f.name, channel: f.channel, lobs: ['Tripstacc', 'Shopstacc'], version: 1, status: 'Active' });
    for (const [si, s] of f.sections.entries()) {
      const sid = `${fid}_${s.id}`;
      await db.insert(t.sections).values({ id: sid, formId: fid, ord: si, name: s.name });
      const ps = s.params.map((p, pi) => ({ id: `${fid}_${p.id}`, formId: fid, sectionId: sid, ord: pi, code: p.id, name: p.name, description: p.desc, weight: p.weight, fatal: p.fatal, options: p.options, guideY: p.guideY, guideN: p.guideN, guideNA: p.guideNA }));
      await db.insert(t.params).values(ps);
    }
  }

  /* ---------- settings ---------- */
  await db.insert(t.settings).values([
    { key: 'sso', value: { tenantId: process.env.AZURE_AD_TENANT_ID || '', domains: process.env.ALLOWED_EMAIL_DOMAINS || 'zipstacc.com', tenantIds: process.env.STAFF_TENANT_IDS || '', allowManual: true, groups: [] } },
    { key: 'notify', value: { inapp: true, email: true, teams: true, mailbox: process.env.GRAPH_SENDER || 'qa-notifications@zipstacc.com' } },
    { key: 'feedbackTargets', value: { deliverH: 48, disputeH: 48, ackH: 72 } },
    { key: 'plan', value: { rates: { Call: 1, Email: 1.5 }, min: 2, newMult: 2, ramp: 3 } },
    { key: 'bp', value: { disputeWindow: { status: 'pending', value: 72 }, aoiForN: { status: 'approved' }, versioning: { status: 'pending' }, maskPhone: { status: 'pending' }, coaching: { status: 'pending', value: 85 }, sampling: { status: 'pending', calls: 4, emails: 2 }, lockAfterAck: { status: 'pending' }, calibration: { status: 'pending' } } },
  ]);

  /* ---------- logins ---------- */
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (!email.includes('@')) throw new Error('Set ADMIN_EMAIL to your Microsoft 365 work email (for example amit.shirke@zipstacc.com).');
  const pw = process.env.ADMIN_PASSWORD;
  if (pw && pw.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters (or leave it empty to use Microsoft 365 only).');
  const users: (typeof t.users.$inferInsert)[] = [{ id: 'u1', name: process.env.ADMIN_NAME || 'Admin', role: 'admin', email, username: email.split('@')[0], passwordHash: pw ? await bcrypt.hash(pw, 12) : null, authSso: true, authPassword: !!pw, companyId: null }];
  for (const [id, name, clientId, companyId, env] of [['uc', 'CUSTCAP', 'custcap', 'expenova', 'CUSTCAP_PASSWORD'], ['uu', 'UPPERCASE', 'uppercase', 'peopleocity', 'UPPERCASE_PASSWORD']] as const) {
    const p = process.env[env] || (env === 'CUSTCAP_PASSWORD' ? process.env.CLIENT_PASSWORD : undefined);
    if (!p) continue;
    if (p.length < 12) throw new Error(`${env} must be at least 12 characters.`);
    users.push({ id, name, role: 'client', email: null, username: name, passwordHash: await bcrypt.hash(p, 12), authSso: false, authPassword: true, clientId, companyId });
  }
  await db.insert(t.users).values(users);
  console.log(`Set up companies, clients, master data and forms, plus ${users.length} login${users.length > 1 ? 's' : ''} (${users.map((u) => u.username).join(', ')}).`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
