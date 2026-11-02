import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, schema as t } from '@/db';
import { requireUser } from '@/lib/auth';
import { getForm, getUsers, loadAudits, nameOf } from '@/lib/data';
import { can, canResolveDispute, canViewAudit } from '@/lib/rbac';
import { scoreOf } from '@/lib/scoring';
import { fdate, fdt } from '@/lib/dates';
import { PageHead, Score, Status, pct, scls } from '@/components/ui';
import { AgentPanel, ResolvePanel, StaffPanel } from './Panels';

export default async function AuditPage({ params: rp }: { params: { id: string } }) {
  const u = await requireUser();
  const [a] = await loadAudits(u, '', '', { ids: [rp.id] });
  if (!a || !canViewAudit(u, a)) notFound();
  const users = await getUsers(), form = await getForm(a.formId); if (!form) notFound();
  const sc = scoreOf(form, a.answers);
  const [fbs, rem] = await Promise.all([db.select().from(t.feedbackSessions).where(eq(t.feedbackSessions.auditId, a.id)), db.select().from(t.reminders).where(eq(t.reminders.auditId, a.id))]);
  const timeline = [
    { at: a.createdAt, text: `Audit submitted by ${nameOf(users, a.auditorId)}` },
    ...fbs.map((x) => ({ at: x.at, text: `Feedback given by ${nameOf(users, x.by)} (${x.mode})${x.note ? ': ' + x.note : ''}` })),
    ...rem.map((x) => ({ at: x.at, text: `Reminder sent to ${nameOf(users, x.toUserId)} by ${nameOf(users, x.by)}` })),
    ...(a.dispute ? [{ at: a.dispute.raisedAt, text: `Disputed by the agent: ${a.dispute.reason}` }] : []),
    ...(a.dispute?.resolvedAt ? [{ at: a.dispute.resolvedAt, text: `Dispute ${a.dispute.outcome?.toLowerCase()} by ${nameOf(users, a.dispute.resolvedBy)}: ${a.dispute.note}` }] : []),
    ...(a.ack ? [{ at: a.ack.at, text: a.ack.auto ? 'Auto-acknowledged (dispute window passed)' : `Acknowledged by the agent${a.ack.suggestion ? ': ' + a.ack.suggestion : ''}` }] : []),
  ].sort((x, y) => +new Date(x.at) - +new Date(y.at));
  const params = form.sections.flatMap((s) => s.params);
  const pinfo = params.map((p) => ({ id: p.id, name: p.name, options: p.options, value: a.answers[p.id] }));
  return (<>
    <PageHead eyebrow={`${a.channel} audit · ${form.name} v${form.version}`} title={a.caseId} sub={<>{nameOf(users, a.agentId)} · {a.lob} · {a.product} · {a.customer} · audited {fdate(a.auditDate)} by {nameOf(users, a.auditorId)} <Status s={a.status} /></>} />
    <div className="audit-layout"><div className="stack">
      <section className="card"><div className="form-grid">
        {[['Agent', nameOf(users, a.agentId)], ['Team leader', nameOf(users, a.tlId)], ['Name of QA', nameOf(users, a.auditorId)], [a.channel === 'Call' ? 'Call date' : 'Email date', fdate(a.interactionDate)], ['Audit date', fdate(a.auditDate)], ['Week ending', fdate(a.weekEnding)], ['Month', a.month], ['Customer phone', u.role === 'client' ? '••••••' + (a.phone || '').slice(-4) : a.phone || '—']].map(([l, v]) => <div key={l} className="field"><span className="eyebrow">{l}</span><span>{v}</span></div>)}
        {a.link && <div className="field span2"><span className="eyebrow">Recording / ticket</span><a className="rel-link" href={a.link} target="_blank" rel="noreferrer">Open link</a></div>}
      </div></section>
      {a.observations && <section className="card"><h3>Observations</h3><p style={{ whiteSpace: 'pre-line', margin: '6px 0 0' }}>{a.observations}</p></section>}
      {a.aois.length > 0 && <section className="card"><h3>Areas of improvement</h3><div className="stack" style={{ gap: 8, marginTop: 8 }}>{a.aois.map((x) => <div key={x.id}><span className="tag-param">{params.find((p) => p.id === x.paramId)?.name || 'General'}</span><p style={{ margin: '4px 0 0' }}>{x.text}</p></div>)}</div></section>}
      {form.sections.map((s, i) => <section key={s.id} className="sec open"><div className="sec-hd"><h3>{s.name}</h3><span className="meta">{sc.sections[i].earned}/{sc.sections[i].total} marks{sc.sections[i].fatal ? ' · fatal' : ''}</span></div>
        <div className="sec-body">{s.params.map((p) => { const v = a.answers[p.id]; return <div key={p.id} className={'prow ' + (v === 'N' ? 'isN' : '')}><div className="pinfo"><div className="pname">{p.name}</div></div><div className="pmeta"><span className="wt">{p.weight}</span>{p.fatal && <span className="chip bad">Fatal</span>}</div><div><span className={'chip ' + (v === 'N' ? 'bad' : v === 'NA' ? '' : 'good')}>{v || '—'}</span>{a.dispute?.paramIds.includes(p.id) && <span className="chip warn" style={{ marginLeft: 6 }}>Disputed</span>}</div></div>; })}</div></section>)}
    </div>
    <aside className="score-pane"><div className="pane-card stack" style={{ gap: 12 }}><div className="eyebrow">Assessment</div>
      <div className="big-scores"><div className="bs"><div className="l">Overall score</div><div className={'v ' + scls(a.overall)}>{pct(a.overall)}</div></div><div className={'bs ' + (a.fatal ? 'fatal' : '')}><div className="l">Actual quality</div><div className={'v ' + (a.fatal ? '' : scls(a.actual))}>{pct(a.actual)}</div></div></div>
      {a.fatal && <div className="note" style={{ borderColor: 'var(--bad)', background: 'var(--bad-soft)' }}>A fatal parameter is marked No, so the Actual quality score is 0.</div>}
      <div>{sc.sections.map((s) => <div key={s.id} className="sec-line"><span className="nm">{s.fatal ? '⚠ ' : ''}{s.name}</span><span className={'mono ' + (s.fatal ? 's-bad' : scls(s.score))}>{s.score == null ? '—' : s.score.toFixed(0) + '%'}</span></div>)}</div></div>
      {u.role === 'agent' && <AgentPanel auditId={a.id} status={a.status} params={pinfo} outcome={a.dispute?.outcome || ''} note={a.dispute?.note || ''} />}
      {a.status === 'Disputed' && canResolveDispute(u, a) && a.dispute && <ResolvePanel auditId={a.id} reason={a.dispute.reason} params={pinfo.filter((p) => a.dispute!.paramIds.includes(p.id))} />}
      {can(u.role, 'feedback.remind') && a.status !== 'Acknowledged' && <StaffPanel auditId={a.id} canLog={can(u.role, 'feedback.log')} />}
      <div className="pane-card stack" style={{ gap: 8 }}><div className="eyebrow">Timeline</div>{timeline.map((x, i) => <div key={i} className="small"><span className="muted">{fdt(x.at)}</span><br />{x.text}</div>)}</div>
    </aside></div>
    <p className="muted small" style={{ marginTop: 10 }}>Score: <Score v={a.actual} fatal={a.fatal} /> actual · {pct(a.overall)} overall</p>
  </>);
}
