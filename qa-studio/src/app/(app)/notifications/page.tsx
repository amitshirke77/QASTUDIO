import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db, schema as t } from '@/db';
import { requireUser } from '@/lib/auth';
import { fdt } from '@/lib/dates';
import { ActionButton } from '@/components/client';
import { markNotificationsRead } from '@/app/actions/ops';
import { PageHead, Empty } from '@/components/ui';
export default async function Notifications() {
  const u = await requireUser();
  const N = await db.select().from(t.notifications).where(eq(t.notifications.userId, u.id)).orderBy(desc(t.notifications.createdAt)).limit(100);
  return (<><PageHead title="Notifications" sub="Also sent by email (Microsoft 365) and Teams when those channels are on." actions={N.some((n) => !n.read) ? <ActionButton label="Mark all as read" action={markNotificationsRead} args={[]} /> : undefined} />
    {N.length ? <div className="card" style={{ padding: 0 }}>{N.map((n) => <div key={n.id} className="ag-todo" style={{ padding: '10px 16px' }}>{!n.read && <span className="chip acc">New</span>}<span className="ag-todo-t">{n.text}<br /><span className="muted small">{fdt(n.createdAt)}</span></span>{n.link && <Link className="btn sm" href={n.link}>Open</Link>}</div>)}</div> : <Empty>No notifications yet.</Empty>}</>);
}
