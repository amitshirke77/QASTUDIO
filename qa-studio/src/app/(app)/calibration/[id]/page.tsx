import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, schema as t } from '@/db';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { getForm, getUsers, nameOf } from '@/lib/data';
import { itemResult, auditorAgreement } from '@/lib/calibration';
import { fdate } from '@/lib/dates';
import { PageHead, Chip, Kpi, pct, scls } from '@/components/ui';
import { ScoreForm, AgreeSelect, CloseForm } from './Client';

export default async function Session({ params, searchParams }: { params: { id: string }; searchParams: { item?: string } }) {
  const u = await requireUser();
  const [cs] = await db.select().from(t.calibSessions).where(eq(t.calibSessions.id, params.id)); if (!cs) notFound();
  const lead = can(u.role, 'calib.run'), viewer = can(u.role, 'calib.view'), part = cs.participants.includes(u.id);
  if (!lead && !viewer && !part) notFound();
  const form = await getForm(cs.formId); if (!form) notFound();
  const users = await getUsers();
  const items = (await db.select().from(t.calibItems).where(eq(t.calibItems.sessionId, cs.id))).sort((a, b) => a.ord - b.ord);
  const scores = await db.select().from(t.calibScores).where(eq(t.calibScores.sessionId, cs.id));
  const agreed = await db.select().from(t.calibAgreed).where(eq(t.calibAgreed.sessionId, cs.id));
  const mine = scores.filter((s) => s.userId === u.id); const todo = items.filter((i) => !mine.some((s) => s.itemId === i.id));
  const params_ = form.sections.flatMap((s) => s.params.map((p) => ({ id: p.id, name: p.name, section: s.name })));
  const canSee = lead || viewer || cs.status === 'Closed' || (part && !todo.length);
  const pack = items.map((i) => ({ params: params_, scores: scores.filter((s) => s.itemId === i.id), agreed: Object.fromEntries(agreed.filter((a) => a.itemId === i.id).map((a) => [a.paramId, a.value])) }));
  const formLite = { sections: form.sections.map((s) => ({ id: s.id, name: s.name, params: s.params.map((p) => ({ id: p.id, name: p.name, weight: p.weight, fatal: p.fatal, options: p.options, guideY: p.guideY, guideN: p.guideN, guideNA: p.guideNA })) })) };
  const scoring = part && cs.status === 'Open' && todo.length > 0;
  return (<>
    <PageHead eyebrow={`Calibration · ${form.name} v${form.version}`} title={cs.title} sub={<>{cs.status === 'Open' ? <Chip tone="warn">Open</Chip> : <Chip tone="good">Closed {fdate(cs.closedAt)}</Chip>} Score by {fdate(cs.due)} · {cs.participants.map((p) => nameOf(users, p)).join(', ')}</>} />
    <div className="kpis">{cs.participants.map((p) => { const n = scores.filter((s) => s.userId === p).length; const ag = canSee ? auditorAgreement(pack, p) : null; return <Kpi key={p} label={nameOf(users, p)} value={canSee && ag != null ? pct(ag) : `${n}/${items.length}`} cls={canSee ? scls(ag) : ''} sub={canSee && ag != null ? `${n}/${items.length} scored · agreement` : 'scored'} />; })}</div>
    {scoring && <ScoreForm sessionId={cs.id} form={formLite} items={todo.map((i) => ({ id: i.id, caseId: i.caseId, link: i.link }))} />}
    {!scoring && !canSee && <div className="card empty">Results open once you have scored every interaction.</div>}
    {canSee && items.map((it, k) => { const r = itemResult(params_, pack[k].scores, pack[k].agreed); const auds = pack[k].scores;
      return <div key={it.id} className="card stack" style={{ marginBottom: 14 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}><h3>{k + 1}. {it.caseId}</h3>{it.link && <a className="rel-link small" href={it.link} target="_blank" rel="noreferrer">Recording</a>}</div>
        <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Auditor</th><th className="r">Overall</th><th className="r">Actual</th><th className="r">vs average</th><th>Note</th></tr></thead><tbody>{r.deviations.map((d) => <tr key={d.userId}><td>{nameOf(users, d.userId)}</td><td className="r"><span className={'score ' + scls(d.overall)}>{pct(d.overall)}</span></td><td className="r"><span className={'score ' + scls(d.actual)}>{pct(d.actual)}</span></td><td className={'r mono ' + (d.dev != null && Math.abs(d.dev) > 3 ? 's-bad' : '')}>{d.dev == null ? '—' : (d.dev > 0 ? '+' : '') + d.dev.toFixed(1)}</td><td className="small">{auds.find((s) => s.userId === d.userId)?.note}</td></tr>)}</tbody></table></div>
        <details open={lead && cs.status === 'Open'}><summary><b>Parameter grid</b> <span className="muted small">{r.rows.filter((x) => (x.agreement ?? 100) < 100).length} parameters with disagreement</span></summary>
          <div className="tbl-wrap" style={{ marginTop: 8 }}><table className="tbl"><thead><tr><th>Parameter</th>{auds.map((s) => <th key={s.userId} className="c">{nameOf(users, s.userId).split(' ')[0]}</th>)}<th className="r">Agreement</th><th>Agreed</th></tr></thead><tbody>{r.rows.map((x) => <tr key={x.p.id} style={{ background: (x.agreement ?? 100) < 100 ? 'var(--warn-soft)' : undefined }}><td className="small">{x.p.name}<div className="muted">{x.p.section}</div></td>{x.vals.map((v, i) => <td key={i} className="c"><span className={'chip ' + (v === 'N' ? 'bad' : v === 'Y' ? 'good' : '')}>{v || '—'}</span></td>)}<td className="r mono">{pct(x.agreement)}</td><td>{lead && cs.status === 'Open' ? <AgreeSelect sessionId={cs.id} itemId={it.id} paramId={x.p.id} value={x.agreed} mode={x.mode} /> : <b>{x.ref}</b>}</td></tr>)}</tbody></table></div></details></div>; })}
    {lead && cs.status === 'Open' && <CloseForm sessionId={cs.id} />}
    {cs.outcome && <div className="card"><h3>Outcome</h3><p style={{ whiteSpace: 'pre-line' }}>{cs.outcome}</p></div>}
  </>);
}
