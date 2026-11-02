import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { activeForms } from '@/lib/data';
import { PageHead, Chip } from '@/components/ui';
export default async function Legend({ searchParams }: { searchParams: { f?: string; q?: string } }) {
  await requireUser(); const forms = await activeForms(); const f = forms.find((x) => x.id === searchParams.f) || forms[0];
  if (!f) return <PageHead title="Evaluation legend" sub="No active form." />;
  const q = (searchParams.q || '').toLowerCase(); const ps = f.sections.flatMap((s) => s.params);
  return (<><PageHead title="Evaluation legend" sub="How every parameter is rated. Y = met. N = not met (add an area of improvement). NA = not applicable, and counts as met. Overall = marks rated Y or NA ÷ total marks. Actual quality = 0 when any fatal parameter is rated N, otherwise equal to Overall." />
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}><div className="seg-sm">{forms.map((x) => <Link key={x.id} href={`/legend?f=${x.id}`} className={x.id === f.id ? 'on' : ''} style={{ textDecoration: 'none', padding: '6px 10px' }}>{x.name}</Link>)}</div>
      <form style={{ marginLeft: 'auto' }}><input type="hidden" name="f" value={f.id} /><input type="search" name="q" defaultValue={searchParams.q || ''} placeholder="Search parameters" aria-label="Search parameters" /></form></div>
    <div className="kpis"><div className="kpi"><span className="l">Sections</span><span className="v">{f.sections.length}</span></div><div className="kpi"><span className="l">Parameters</span><span className="v">{ps.length}</span></div><div className="kpi"><span className="l">Total marks</span><span className="v">{ps.reduce((s, p) => s + p.weight, 0)}</span></div><div className="kpi"><span className="l">Marks in fatal parameters</span><span className="v s-bad">{ps.filter((p) => p.fatal).reduce((s, p) => s + p.weight, 0)}</span></div><div className="kpi"><span className="l">LOBs</span><span className="v" style={{ fontSize: '1rem' }}>{f.lobs.join(', ')}</span></div></div>
    {f.sections.map((s) => { const sp = s.params.filter((p) => !q || (p.name + p.description + p.guideY + p.guideN).toLowerCase().includes(q)); if (!sp.length) return null; const tot = s.params.reduce((a, p) => a + p.weight, 0);
      return <section key={s.id} className="card stack" style={{ marginBottom: 12 }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><h2>{s.name}</h2><span className="muted small">{tot} marks · {tot}% of the score</span></div>
        {sp.map((p) => <div key={p.id} className="ag-todo" style={{ alignItems: 'flex-start' }}><div style={{ flex: 1, minWidth: 260 }}><b>{p.name}</b> <span className="muted small">{p.weight} marks · {p.options.join(' / ')}</span> {p.fatal ? <Chip tone="bad">Fatal</Chip> : <Chip>Non-fatal</Chip>}<p className="small" style={{ margin: '4px 0' }}>{p.description}</p>
          <div className="grid g3 small"><div><b className="s-good">Rate Y when</b><br />{p.guideY || '—'}</div><div><b className="s-bad">Rate N when</b><br />{p.guideN || '—'}</div><div><b>Rate NA when</b><br />{p.options.includes('NA') ? p.guideNA || '—' : 'Not allowed for this parameter'}</div></div></div></div>)}</section>; })}
  </>);
}
