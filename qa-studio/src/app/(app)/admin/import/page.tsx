import { desc } from 'drizzle-orm';
import { db, schema as t } from '@/db';
import { requireUser } from '@/lib/auth';
import { activeForms, getUsers, nameOf } from '@/lib/data';
import { fdt } from '@/lib/dates';
import { ActionButton } from '@/components/client';
import { undoImport } from '@/app/actions/import';
import { PageHead } from '@/components/ui';
import ImportForm from './ImportForm';
import { hierarchy, scopedUserIds } from '@/lib/scope';
export default async function Import() {
  const u = await requireUser('import'); const users = await getUsers(); const forms = await activeForms(); const h = await hierarchy(u); const ids = await scopedUserIds(u); const lobs = await db.select().from(t.lobs);
  const batches = await db.select().from(t.importBatches).orderBy(desc(t.importBatches.at));
  return (<><PageHead title="Import past audits" sub="Upload the Quality Sheet (xlsx or csv). Pick the client first. Columns are matched by header: Case ID, Agent, QA, TL, Audit date, Call date, Customer, Product, LOB, Observations, and one column per parameter (Y / N / NA). Preview first; nothing is saved until you import. Imported audits count in dashboards and are marked acknowledged." />
    <ImportForm forms={forms.map((f) => ({ id: f.id, name: `${f.name} v${f.version}`, lobs: f.lobs }))} tls={users.filter((x) => x.role === 'tl' && (!ids || ids.has(x.id))).map((x) => ({ id: x.id, name: x.name, companyId: x.companyId }))} clients={h.clients.map((c) => ({ id: c.id, name: c.name, companyId: c.companyId }))} lobs={lobs.map((l) => ({ name: l.name, clientId: l.clientId }))} />
    {batches.length > 0 && <div className="tbl-wrap" style={{ marginTop: 14 }}><table className="tbl"><thead><tr><th>File</th><th>When</th><th>By</th><th className="r">Imported</th><th className="r">Skipped</th><th></th></tr></thead><tbody>{batches.map((b) => <tr key={b.id}><td>{b.file}</td><td>{fdt(b.at)}</td><td>{nameOf(users, b.importedBy)}</td><td className="r mono">{b.count}</td><td className="r mono">{b.skipped}</td><td className="r"><ActionButton className="sm danger" label="Undo" confirm="Delete every audit from this import?" success="Import undone" action={undoImport} args={[b.id]} /></td></tr>)}</tbody></table></div>}</>);
}
