import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getUsers, nameOf, loadAudits, paramIndex } from '@/lib/data';
import { learningAll, itemStats } from '@/lib/learning';
import { quizStats, isScored, QT } from '@/lib/quiz';
import { canGradeQuiz } from '@/lib/rbac';
import { addDays, fdate, fdt, today } from '@/lib/dates';
import { avg } from '@/lib/util';
import { ActionButton } from '@/components/client';
import { archiveLearning, remindLearning } from '@/app/actions/learning';
import { Kpi, PageHead, Chip, pct, scls } from '@/components/ui';
import { FileList } from '@/components/learning/Attachments';
import { filesFor } from '@/lib/learningFiles';

export default async function Item({ params }: { params: { id: string } }) {
  const u = await requireUser('learning.create');
  const { items, asg, subs } = await learningAll(); const it = items.find((i) => i.id === params.id); if (!it) notFound();
  const users = await getUsers(), pidx = await paramIndex(); const s = itemStats(asg, it); const A = asg.filter((a) => a.itemId === it.id);
  const S = subs.filter((x) => x.itemId === it.id); const qs = quizStats(S);
  // effect on linked parameters (JIT)
  let fx: { b: { p: number; n: number } | null; a: { p: number; n: number } | null } | null = null;
  if (it.type === 'JIT' && it.params.length && it.publishedAt) {
    const pub = it.publishedAt.toISOString().slice(0, 10), ids = new Set(A.map((x) => x.agentId)); const pids = Object.values(pidx).filter((p) => it.params.includes(p.code)).map((p) => p.id);
    const aud = (await loadAudits(u, addDays(pub, -30), today())).filter((a) => ids.has(a.agentId));
    const rate = (from: string, to: string) => { let r = 0, n = 0; aud.forEach((a) => { if (a.auditDate < from || a.auditDate > to) return; pids.forEach((p) => { if (a.answers[p]) { r++; if (a.answers[p] === 'N') n++; } }); }); return r ? { p: (n / r) * 100, n: r } : null; };
    fx = { b: rate(addDays(pub, -30), addDays(pub, -1)), a: rate(pub, today()) };
  }
  const scored = S.filter((x) => x.status === 'Scored'); const files = await filesFor(it.id);
  return (<>
    <PageHead eyebrow={`${it.type === 'JIT' ? 'JIT training' : 'Briefing note'} · ${it.status}`} title={it.title} sub={`Published ${fdate(it.publishedAt)} by ${nameOf(users, it.createdBy)}${it.due ? ' · accept by ' + fdate(it.due) : ''}`}
      actions={<><Link className="btn" href="/learning">Back</Link>{it.status === 'Published' && s.n - s.ac > 0 && <ActionButton className="primary" label={`Remind ${s.n - s.ac} pending`} success="Reminders sent" action={remindLearning} args={[it.id]} />}{it.status === 'Published' && <ActionButton label="Archive" confirm="Archive this item?" action={archiveLearning} args={[it.id]} />}</>} />
    <div className="kpis"><Kpi label="Assigned" value={s.n} /><Kpi label="Opened" value={s.op} sub={pct(s.opP)} /><Kpi label="Accepted" value={s.ac} cls={scls(s.acP)} sub={pct(s.acP)} /><Kpi label="Accepted on time" value={pct(s.otP)} /><Kpi label="Overdue" value={s.overdue} cls={s.overdue ? 's-bad' : ''} /></div>
    {fx && <div className="card" style={{ marginBottom: 14, display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}><div style={{ flex: 1, minWidth: 220 }}><h3>Effect on the linked parameters</h3><p className="muted small" style={{ margin: '4px 0 0' }}>“No” rate for the agents who received this, 30 days before against since publishing.</p></div><div className="lrn-fx"><div><span className="muted small">30 days before</span><b className="mono">{fx.b ? pct(fx.b.p) : '—'}</b></div><span className="lrn-arrow">→</span><div><span className="muted small">Since publishing</span><b className="mono">{fx.a ? pct(fx.a.p) : '—'}</b></div></div></div>}
    {it.quiz?.enabled && <div className="card stack" style={{ marginBottom: 14 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}><h3>Quiz results</h3><span className="muted small">{it.quiz.questions.length} questions · pass mark {it.quiz.passPct}% · {it.quiz.attempts} attempts · best attempt per agent</span></div>
      <div className="kpis" style={{ margin: 0 }}><Kpi label="Agents who took it" value={`${qs.takers}/${s.n}`} /><Kpi label="Average score" value={pct(qs.avg)} cls={scls(qs.avg)} /><Kpi label="Pass rate" value={pct(qs.pass)} /><Kpi label="Awaiting grading" value={qs.awaiting} cls={qs.awaiting ? 's-warn' : ''} /><Kpi label="Not taken yet" value={A.filter((a) => a.acceptedAt).length - qs.takers} sub="accepted, no quiz" /></div>
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Question</th><th className="r">Answered</th><th className="r">Full marks</th><th className="r">Avg points</th></tr></thead><tbody>{it.quiz.questions.filter(isScored).map((q) => { const got = scored.map((x) => { const m = x.manual[q.id]; return m && m.points != null ? +m.points : x.auto[q.id]; }).filter((x): x is number => x != null); const full = got.filter((x) => x >= q.points).length; return <tr key={q.id}><td className="small">{q.text}<div className="muted">{QT[q.type]}</div></td><td className="r mono">{got.length}</td><td className="r"><span className={'score ' + (got.length && full / got.length < 0.6 ? 's-bad' : '')}>{got.length ? pct((full / got.length) * 100) : '—'}</span></td><td className="r mono">{got.length ? avg(got)!.toFixed(1) + '/' + q.points : '—'}</td></tr>; })}</tbody></table></div>
      {S.length > 0 && <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Agent</th><th>Submitted</th><th className="r">Score</th><th>Result</th><th></th></tr></thead><tbody>{S.sort((a, b) => +b.at - +a.at).map((x) => <tr key={x.id}><td>{nameOf(users, x.agentId)}</td><td className="small">{fdt(x.at)}</td><td className="r">{x.status === 'Scored' ? <span className={'score ' + scls(x.pct)}>{x.score}/{x.max} · {pct(x.pct)}</span> : '—'}</td><td>{x.status !== 'Scored' ? <Chip tone="warn">Awaiting grading</Chip> : x.passed ? <Chip tone="good">Passed</Chip> : <Chip tone="bad">Not passed</Chip>}</td><td className="r">{canGradeQuiz(u, it) && <Link className={'btn sm ' + (x.status !== 'Scored' ? 'primary' : '')} href={`/learning/grade/${x.id}`}>{x.status !== 'Scored' ? 'Grade' : 'Review'}</Link>}</td></tr>)}</tbody></table></div>}</div>}
    <div className="grid g2"><div className="card stack"><h3>Content</h3><div className="lrn-body" style={{ whiteSpace: 'pre-line' }}>{it.body}</div>{files.length > 0 && <div className="stack" style={{ gap: 6 }}><div className="eyebrow">Attachments · {files.length}</div><FileList files={files} /></div>}{it.params.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{[...new Set(Object.values(pidx).filter((p) => it.params.includes(p.code)).map((p) => p.name))].map((n) => <span key={n} className="tag-param">{n}</span>)}</div>}</div>
      <div className="card" style={{ padding: 0 }}><div style={{ padding: '14px 16px' }}><h3>Agents</h3></div><div className="tbl-wrap" style={{ border: 0, borderTop: '1px solid var(--line)', borderRadius: 0 }}><table className="tbl"><thead><tr><th>Agent</th><th>TL</th><th>Opened</th><th>Accepted</th><th>Comment</th></tr></thead><tbody>{A.sort((a, b) => (a.acceptedAt ? 1 : 0) - (b.acceptedAt ? 1 : 0)).map((a) => { const ag = users.find((x) => x.id === a.agentId); return <tr key={a.agentId}><td><b>{ag?.name}</b></td><td className="small">{nameOf(users, ag?.tlId)}</td><td className="small">{a.openedAt ? fdt(a.openedAt) : <span className="muted">Not yet</span>}</td><td className="small">{a.acceptedAt ? fdt(a.acceptedAt) : <span className="muted">Pending</span>}</td><td className="small">{a.comment}</td></tr>; })}</tbody></table></div></div></div>
  </>);
}
