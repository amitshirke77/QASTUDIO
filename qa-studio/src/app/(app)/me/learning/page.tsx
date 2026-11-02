import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { getUsers, nameOf } from '@/lib/data';
import { learningAll } from '@/lib/learning';
import { agentQuizState } from '@/lib/quiz';
import { fdate, today } from '@/lib/dates';
import { Kpi, PageHead, Chip, Empty } from '@/components/ui';
export default async function MyLearning() {
  const u = await requireRole('agent'); const users = await getUsers();
  const { items, asg, subs } = await learningAll();
  const mine = asg.filter((a) => a.agentId === u.id).map((a) => ({ a, i: items.find((x) => x.id === a.itemId)! })).filter((x) => x.i?.status === 'Published').sort((x, y) => +(y.i.publishedAt || 0) - +(x.i.publishedAt || 0));
  const st = (x: (typeof mine)[number]) => agentQuizState(x.i.quiz, !!x.a.acceptedAt, subs.filter((s) => s.itemId === x.i.id && s.agentId === u.id).sort((p, q) => +p.at - +q.at));
  const pend = mine.filter((x) => !x.a.acceptedAt), done = mine.filter((x) => x.a.acceptedAt);
  const card = (x: (typeof mine)[number]) => { const q = st(x); const od = !x.a.acceptedAt && x.i.due && x.i.due < today();
    return <Link key={x.i.id} href={`/me/learning/${x.i.id}`} className="card lrn-row" style={{ textDecoration: 'none' }}><div className="lrn-main"><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Chip tone={x.i.type === 'JIT' ? 'acc' : 'warn'}>{x.i.type === 'JIT' ? 'JIT training' : 'Briefing note'}</Chip>{q && <Chip tone={q.state === 'passed' ? 'good' : q.state === 'todo' || q.state === 'retry' ? 'warn' : ''}>Quiz · {q.label}</Chip>}{x.a.acceptedAt ? <Chip tone="good">Accepted {fdate(x.a.acceptedAt)}</Chip> : od ? <Chip tone="bad">Overdue</Chip> : x.i.due ? <Chip>Accept by {fdate(x.i.due)}</Chip> : null}</div><h3 style={{ marginTop: 6 }}>{x.i.title}</h3><p className="muted small" style={{ margin: '2px 0 0' }}>From {nameOf(users, x.i.createdBy)} · {fdate(x.i.publishedAt)}</p></div></Link>; };
  return (<><PageHead title="My learning" sub="Trainings and briefing notes sent to you. Read each one and accept it; some trainings have a short quiz after." />
    <div className="kpis"><Kpi label="To accept" value={pend.length} cls={pend.length ? 's-warn' : ''} /><Kpi label="Overdue" value={pend.filter((x) => x.i.due && x.i.due < today()).length} /><Kpi label="Quizzes to take" value={mine.filter((x) => ['todo', 'retry'].includes(st(x)?.state || '')).length} /><Kpi label="Accepted" value={done.length} cls="s-good" /></div>
    <h3 style={{ margin: '6px 0 10px' }}>To read and accept</h3>{pend.length ? <div className="stack">{pend.map(card)}</div> : <Empty>You are up to date.</Empty>}
    {done.length > 0 && <><h3 style={{ margin: '20px 0 10px' }}>Accepted</h3><div className="stack">{done.map(card)}</div></>}</>);
}
