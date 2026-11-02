import { desc, inArray } from 'drizzle-orm';
import { db, schema as t } from '@/db';
import { requireUser } from '@/lib/auth';
import { scopeOf, visibleUsers } from '@/lib/scope';
import { activeForms, getUsers, nameOf } from '@/lib/data';
import { PageHead } from '@/components/ui';
import NewSession from './NewSession';
export default async function NewCal() {
  const u = await requireUser('calib.run'); const sc = await scopeOf(u);
  const users = await visibleUsers(u, await getUsers()); const forms = await activeForms();
  const recent = (await db.select().from(t.audits).where(sc ? inArray(t.audits.clientId, sc.length ? sc : ['__none__']) : undefined).orderBy(desc(t.audits.auditDate)).limit(80)).map((a) => ({ id: a.id, caseId: a.caseId, formId: a.formId, link: a.link || '', label: `${a.caseId} · ${nameOf(users, a.agentId)} · ${a.customer} · ${a.auditDate}` }));
  return (<><PageHead title="New calibration session" sub="Pick up to five interactions. Participants score them blind; the original audit score is hidden from them." />
    <NewSession forms={forms.map((f) => ({ id: f.id, name: `${f.name} v${f.version}` }))} audits={recent} people={users.filter((x) => ['auditor', 'qalead'].includes(x.role) && x.active).map((x) => ({ id: x.id, name: x.name }))} /></>);
}
