import Link from 'next/link';
import { desc } from 'drizzle-orm';
import { db, schema as t } from '@/db';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { getForms, getUsers, nameOf } from '@/lib/data';
import { auditorAgreement } from '@/lib/calibration';
import { fdate } from '@/lib/dates';
import { PageHead, Chip, Empty, pct, scls } from '@/components/ui';
import QChart from '@/components/Charts';
import { sessionAgreement } from '@/lib/calibData';
export default async function Calibration() {
  const u = await requireUser();
  if (!can(u.role, 'calib.view') && !can(u.role, 'calib.participate') && !can(u.role, 'calib.run')) return <Empty>Calibration is for QA Auditors, QA Leads and Managers.</Empty>;
  const users = await getUsers();
  const S = (await db.select().from(t.calibSessions).orderBy(desc(t.calibSessions.createdAt))).filter((s) => can(u.role, 'calib.view') || can(u.role, 'calib.run') || s.participants.includes(u.id));
  const [items, scores] = await Promise.all([db.select().from(t.calibItems), db.select().from(t.calibScores)]);
  const closed = S.filter((s) => s.status === 'Closed').slice(0, 6).reverse();
  const agree: Record<string, (number | null)[]> = {};
  for (const [k, s] of closed.entries()) { const { pack } = await sessionAgreement(s.id, s.formId); s.participants.forEach((p) => { (agree[p] = agree[p] || Array(closed.length).fill(null))[k] = auditorAgreement(pack, p); }); }
  return (<>
    <PageHead title="Calibration" sub="Auditors score the same interactions blind, then compare ratings parameter by parameter and agree the right answer. Aim for 95%+ agreement; below 90% means a re-brief." actions={can(u.role, 'calib.run') ? <Link className="btn primary" href="/calibration/new">New session</Link> : undefined} />
    {S.length ? <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Session</th><th>Form</th><th>Status</th><th>Due</th><th className="r">Scored</th><th></th></tr></thead><tbody>
      {S.map((s) => { const it = items.filter((i) => i.sessionId === s.id); const sc = scores.filter((x) => x.sessionId === s.id); const mine = sc.filter((x) => x.userId === u.id).length; return <tr key={s.id}><td><b>{s.title}</b><div className="muted small">by {nameOf(users, s.createdBy)} · {s.participants.length} participants</div></td><td className="small">{s.formId}</td><td><Chip tone={s.status === 'Open' ? 'warn' : 'good'}>{s.status}</Chip></td><td>{fdate(s.due)}</td><td className="r mono">{sc.length}/{it.length * s.participants.length}{s.participants.includes(u.id) && s.status === 'Open' ? ` · you ${mine}/${it.length}` : ''}</td><td className="r"><Link className={'btn sm ' + (s.participants.includes(u.id) && mine < it.length && s.status === 'Open' ? 'primary' : '')} href={`/calibration/${s.id}`}>{s.participants.includes(u.id) && mine < it.length && s.status === 'Open' ? 'Score' : 'Open'}</Link></td></tr>; })}
    </tbody></table></div> : <Empty>No calibration sessions yet.</Empty>}
    {closed.length > 0 && <div className="grid g2" style={{ marginTop: 14 }}><div className="card chart-card"><div className="hd"><h3>Auditor agreement over time</h3><span className="muted small">Last {closed.length} closed sessions</span></div><QChart labels={closed.map((s) => s.title.slice(0, 20))} sets={Object.entries(agree).map(([p, v], i) => ({ label: nameOf(users, p), data: v, color: i }))} /></div>
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Auditor</th><th className="r">Average agreement</th></tr></thead><tbody>{Object.entries(agree).map(([p, v]) => { const x = v.filter((y): y is number => y != null); const m = x.length ? x.reduce((a, b) => a + b, 0) / x.length : null; return <tr key={p}><td>{nameOf(users, p)}</td><td className="r"><span className={'score ' + scls(m)}>{pct(m)}</span></td></tr>; })}</tbody></table></div></div>}
  </>);
}
