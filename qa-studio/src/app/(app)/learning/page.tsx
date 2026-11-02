import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getUsers, nameOf } from '@/lib/data';
import { learningAll, itemStats, gradingQueue } from '@/lib/learning';
import { fdate, fdt, today } from '@/lib/dates';
import { PageHead, Chip, Empty } from '@/components/ui';
const LT: Record<string, [string, string]> = { JIT: ['JIT training', 'acc'], Briefing: ['Briefing note', 'warn'] };
const audLabel = (a: { kind: string; value?: string; days?: number }, tl: (id?: string) => string) => ({ all: 'All agents', lob: `${a.value} agents`, team: `${tl(a.value)}'s team`, agents: 'Selected agents', missed: `Agents who missed the linked parameters in ${a.days || 30} days` } as Record<string, string>)[a.kind];

export default async function Learning({ searchParams }: { searchParams: { tab?: string } }) {
  const u = await requireUser('learning.create');
  const tab = searchParams.tab || 'Published'; const users = await getUsers(); const { items, asg, subs } = await learningAll(); const q = await gradingQueue(u);
  const list = items.filter((i) => i.status === tab).sort((a, b) => +(b.publishedAt || b.createdAt) - +(a.publishedAt || a.createdAt));
  return (<>
    <PageHead title="Learning" sub="Create a just-in-time training or a briefing note, add an optional quiz, send it to a group of agents, and track who has opened, accepted and passed it." actions={<><Link className="btn" href="/learning/new?type=Briefing">New briefing note</Link><Link className="btn primary" href="/learning/new?type=JIT">New JIT training</Link></>} />
    <div className="seg-sm" role="group" style={{ marginBottom: 14 }}>{['Published', 'Draft', 'Archived'].map((s) => <Link key={s} href={`/learning?tab=${s}`} className={tab === s ? 'on' : ''} style={{ textDecoration: 'none', padding: '6px 10px' }}>{s} ({items.filter((i) => i.status === s).length})</Link>)}<Link href="/learning?tab=grading" className={tab === 'grading' ? 'on' : ''} style={{ textDecoration: 'none', padding: '6px 10px' }}>Quiz grading ({q.length})</Link></div>
    {tab === 'grading' ? (q.length ? <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Training</th><th>Agent</th><th>Submitted</th><th className="r">Auto-scored so far</th><th></th></tr></thead><tbody>{q.map(({ i, s }) => <tr key={s.id}><td>{i.title}</td><td>{nameOf(users, s.agentId)}</td><td className="small">{fdt(s.at)}</td><td className="r mono">{s.score}/{s.max}</td><td className="r"><Link className="btn primary sm" href={`/learning/grade/${s.id}`}>Grade</Link></td></tr>)}</tbody></table></div> : <Empty>Nothing waiting for grading.</Empty>)
      : list.length ? <div className="stack">{list.map((i) => { const s = itemStats(asg, i); const qs = subs.filter((x) => x.itemId === i.id);
        return <Link key={i.id} href={i.status === 'Draft' ? `/learning/${i.id}/edit` : `/learning/${i.id}`} className="card lrn-row" style={{ textDecoration: 'none' }}>
          <div className="lrn-main"><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}><Chip tone={LT[i.type][1]}>{LT[i.type][0]}</Chip>{i.quiz?.enabled && <Chip>Quiz · {qs.length} attempts</Chip>}{i.due && i.due < today() && s.overdue ? <Chip tone="bad">{s.overdue} overdue</Chip> : i.due ? <Chip>Due {fdate(i.due)}</Chip> : null}</div>
            <h3 style={{ marginTop: 6 }}>{i.title}</h3><p className="muted small" style={{ margin: '2px 0 0' }}>{audLabel(i.audience, (id) => nameOf(users, id))} · by {nameOf(users, i.createdBy)}{i.publishedAt ? ' · published ' + fdate(i.publishedAt) : ' · draft'}</p></div>
          {i.status === 'Draft' ? <span className="btn sm">Edit draft</span> : <div className="lrn-prog"><div className="small" style={{ display: 'flex', justifyContent: 'space-between' }}><span>Accepted</span><b className="mono">{s.ac}/{s.n}</b></div><div className="bar"><i style={{ width: (s.acP || 0) + '%' }} /></div><div className="small muted" style={{ display: 'flex', justifyContent: 'space-between' }}><span>Opened</span><span className="mono">{s.op}/{s.n}</span></div></div>}
        </Link>; })}</div> : <Empty>{tab === 'Published' ? 'Nothing published yet.' : tab === 'Draft' ? 'No drafts.' : 'Nothing archived.'}</Empty>}
  </>);
}
