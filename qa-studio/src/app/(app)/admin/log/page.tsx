import { desc } from 'drizzle-orm';
import { db, schema as t } from '@/db';
import { requireUser } from '@/lib/auth';
import { fdt } from '@/lib/dates';
import { PageHead } from '@/components/ui';
export default async function Log() { await requireUser('log.view'); const L = await db.select().from(t.activityLog).orderBy(desc(t.activityLog.at)).limit(300);
  return <><PageHead title="Activity log" sub="Sign-ins and changes, newest first." /><div className="tbl-wrap"><table className="tbl"><thead><tr><th>When</th><th>What</th></tr></thead><tbody>{L.map((x) => <tr key={x.id}><td className="small" style={{ whiteSpace: 'nowrap' }}>{fdt(x.at)}</td><td>{x.text}</td></tr>)}</tbody></table></div></>; }
