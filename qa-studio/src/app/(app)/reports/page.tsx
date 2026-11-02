import Link from 'next/link';
import { db, schema as t } from '@/db';
import { requireUser } from '@/lib/auth';
import { getUsers, nameOf, parseFilters } from '@/lib/data';
import { filterOptions } from '@/lib/filters';
import { CATEGORIES, loadReportCtx, reportsFor } from '@/lib/reports';
import { can } from '@/lib/rbac';
import { fdate } from '@/lib/dates';
import { FilterBar } from '@/components/client';
import DataTable from '@/components/DataTable';
import { PageHead } from '@/components/ui';
import { CustomReportButtons } from './Custom';

export default async function Reports({ searchParams }: { searchParams: Record<string, string> }) {
  const u = await requireUser('reports');
  const f = parseFilters(searchParams); const list = reportsFor(u.role); const q = (searchParams.q || '').toLowerCase();
  const custom = u.role === 'client' ? [] : await db.select().from(t.customReports);
  const cur = searchParams.r || list[0].id; const rep = list.find((x) => x.id === cur); const cr = custom.find((x) => x.id === cur);
  const users = await getUsers(), opts = await filterOptions(u, users);
  const res = rep ? rep.run(await loadReportCtx(u, f)) : null;
  const href = (id: string) => `/reports?${new URLSearchParams({ ...searchParams, r: id })}`;
  return (<>
    <PageHead title="Reports" sub={`Ready-made reports that follow the filters. Click a column to sort; copy any table into Excel.${u.role === 'client' ? '' : ' Custom reports you specify later appear in the same list.'}`} />
    <FilterBar {...opts} from={f.from} to={f.to} />
    <div className="rc-layout"><aside className="card rc-nav">
      <form>{Object.entries(searchParams).filter(([k]) => k !== 'q').map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}<input type="search" name="q" defaultValue={searchParams.q || ''} placeholder="Search reports" aria-label="Search reports" style={{ marginBottom: 8, width: '100%' }} /></form>
      {CATEGORIES.map(([c]) => { const items = list.filter((x) => x.cat === c && (!q || (x.name + ' ' + x.desc).toLowerCase().includes(q))); return items.length ? <div key={c} className="rc-grp"><div className="eyebrow">{c}</div>{items.map((x) => <Link key={x.id} href={href(x.id)} className={'rc-item ' + (x.id === cur ? 'on' : '')}>{x.name}</Link>)}</div> : null; })}
      {u.role !== 'client' && <div className="rc-grp"><div className="eyebrow">Custom reports</div>{custom.map((x) => <Link key={x.id} href={href(x.id)} className={'rc-item ' + (x.id === cur ? 'on' : '')}>{x.name} <span className="chip warn" style={{ fontSize: '.66rem' }}>{x.status}</span></Link>)}{can(u.role, 'reports.custom') && <CustomReportButtons />}</div>}
    </aside><div style={{ minWidth: 0 }}>
      {rep && res && <div className="card"><div className="rc-hd" style={{ padding: '0 0 10px' }}><div style={{ flex: 1 }}><div className="eyebrow">{rep.cat}</div><h2 style={{ marginTop: 2 }}>{rep.name}</h2><p className="muted small" style={{ margin: '4px 0 0', maxWidth: '80ch' }}>{rep.desc}</p></div></div>
        <DataTable key={rep.id} cols={res.cols} rows={res.rows} sort={res.sort} dir={res.dir} /></div>}
      {cr && <div className="card stack"><div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><div><div className="eyebrow">Custom report · {cr.status}</div><h2>{cr.name}</h2></div>{can(u.role, 'reports.custom') && <CustomReportButtons edit={cr} />}</div>
        <div className="note">This slot is reserved for a report you will specify. Once the format is shared, it is built here and appears for the roles listed below.</div>
        <div className="grid g2">{[['Purpose', cr.purpose], ['Metrics and columns', cr.cols], ['Filters and slices', cr.filters], ['Who sees it', cr.audience], ['Frequency', cr.freq], ['Requested by', nameOf(users, cr.by) + ' · ' + fdate(cr.at)]].map(([l, v]) => <div key={l}><div className="eyebrow">{l}</div><p style={{ margin: '4px 0 0', whiteSpace: 'pre-line' }}>{v || '—'}</p></div>)}</div></div>}
    </div></div>
  </>);
}
