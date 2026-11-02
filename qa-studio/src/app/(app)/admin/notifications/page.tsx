import { desc } from 'drizzle-orm';
import { db, schema as t } from '@/db';
import { requireUser } from '@/lib/auth';
import { getSetting } from '@/lib/data';
import { DEFAULT_FB } from '@/lib/feedback';
import { fdt } from '@/lib/dates';
import { PageHead, Chip } from '@/components/ui';
import { NotifyForm } from '../Settings';
export default async function N() {
  await requireUser('admin.settings');
  const v = await getSetting('notify', { inapp: true, email: true, teams: true }), fb = await getSetting('feedbackTargets', DEFAULT_FB);
  const ob = await db.select().from(t.outbox).orderBy(desc(t.outbox.createdAt)).limit(50);
  return <><PageHead title="Notifications" sub={`Email sends from ${process.env.GRAPH_SENDER || '(GRAPH_SENDER not set)'}; Teams posts to ${process.env.TEAMS_WEBHOOK_URL ? 'the configured channel webhook' : '(TEAMS_WEBHOOK_URL not set)'}. The outbox is sent every 5 minutes and retried up to 5 times.`} /><NotifyForm v={v} fb={fb} />
    <div className="tbl-wrap" style={{ marginTop: 14 }}><table className="tbl"><thead><tr><th>Queued</th><th>Channel</th><th>To</th><th>Subject</th><th>Status</th><th>Error</th></tr></thead><tbody>{ob.map((m) => <tr key={m.id}><td className="small">{fdt(m.createdAt)}</td><td>{m.channel}</td><td className="small">{m.to}</td><td className="small">{m.subject}</td><td><Chip tone={m.status === 'Sent' ? 'good' : m.status === 'Failed' ? 'bad' : 'warn'}>{m.status}</Chip></td><td className="small muted">{m.lastError}</td></tr>)}</tbody></table></div></>;
}
