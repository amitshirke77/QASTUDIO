'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveFormVersion } from '@/app/actions/admin';
import { useAction } from '@/components/client';
type P = { code: string; name: string; description: string; weight: number; fatal: boolean; options: ('Y' | 'N' | 'NA')[]; guideY: string; guideN: string; guideNA: string };
type F = { id: string; name: string; lobs: string[]; sections: { name: string; params: P[] }[] };
export default function FormEditor({ base }: { base: F }) {
  const [f, setF] = useState(base); const { run, pending, error } = useAction(); const router = useRouter();
  const total = f.sections.reduce((s, x) => s + x.params.reduce((a, p) => a + (+p.weight || 0), 0), 0);
  const up = (si: number, pi: number, v: Partial<P>) => setF({ ...f, sections: f.sections.map((s, i) => (i !== si ? s : { ...s, params: s.params.map((p, j) => (j === pi ? { ...p, ...v } : p)) })) });
  const save = (activate: boolean) => run(() => saveFormVersion({ baseId: base.id, name: f.name, lobs: f.lobs, sections: f.sections, activate }), { success: activate ? 'New version is active' : 'Saved as draft', then: () => router.push('/admin/forms') });
  return (<div className="stack">
    <div className="card inline-form"><div className="field" style={{ flex: 1 }}><label htmlFor="fm_n">Form name</label><input id="fm_n" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div className="field"><label>Mapped to LOB</label><div style={{ display: 'flex', gap: 12 }}>{['Tripstacc', 'Shopstacc'].map((l) => <label key={l} className="check"><input type="checkbox" checked={f.lobs.includes(l)} onChange={(e) => setF({ ...f, lobs: e.target.checked ? [...f.lobs, l] : f.lobs.filter((x) => x !== l) })} /> {l}</label>)}</div></div>
      <div className={'kpi'}><span className="l">Total marks</span><span className={'v ' + (Math.abs(total - 100) < 0.001 ? 's-good' : 's-bad')}>{total}</span></div></div>
    {f.sections.map((s, si) => <section key={si} className="card stack"><div className="inline-form"><div className="field" style={{ flex: 1 }}><label>Section</label><input value={s.name} onChange={(e) => setF({ ...f, sections: f.sections.map((x, i) => (i === si ? { ...x, name: e.target.value } : x)) })} /></div><button className="btn ghost sm" onClick={() => setF({ ...f, sections: f.sections.filter((_, i) => i !== si) })}>Remove section</button></div>
      {s.params.map((p, pi) => <details key={pi} className="card" style={{ padding: 10 }}><summary><b>{p.name || 'New parameter'}</b> <span className="muted small">{p.weight} marks{p.fatal ? ' · fatal' : ''} · {p.options.join('/')}</span></summary>
        <div className="form-grid" style={{ marginTop: 8 }}><div className="field span2"><label>Parameter</label><input value={p.name} onChange={(e) => up(si, pi, { name: e.target.value })} /></div><div className="field"><label>Code</label><input value={p.code} onChange={(e) => up(si, pi, { code: e.target.value })} /></div><div className="field"><label>Marks</label><input type="number" min={0} value={p.weight} onChange={(e) => up(si, pi, { weight: +e.target.value })} /></div>
          <div className="field span2"><label>What is checked</label><textarea rows={2} value={p.description} onChange={(e) => up(si, pi, { description: e.target.value })} /></div>
          <div className="field"><label>Rate Y when</label><textarea rows={2} value={p.guideY} onChange={(e) => up(si, pi, { guideY: e.target.value })} /></div><div className="field"><label>Rate N when</label><textarea rows={2} value={p.guideN} onChange={(e) => up(si, pi, { guideN: e.target.value })} /></div><div className="field"><label>Rate NA when</label><textarea rows={2} value={p.guideNA} onChange={(e) => up(si, pi, { guideNA: e.target.value })} /></div>
          <div className="field"><label>Options</label><div style={{ display: 'flex', gap: 8 }}>{(['Y', 'N', 'NA'] as const).map((o) => <label key={o} className="check small"><input type="checkbox" checked={p.options.includes(o)} disabled={o !== 'NA'} onChange={(e) => up(si, pi, { options: e.target.checked ? ['Y', 'N', 'NA'] : ['Y', 'N'] })} /> {o}</label>)}</div></div></div>
        <div style={{ display: 'flex', gap: 12, marginTop: 6 }}><label className="check"><input type="checkbox" checked={p.fatal} onChange={(e) => up(si, pi, { fatal: e.target.checked })} /> Fatal (a No makes Actual 0)</label><button className="btn ghost sm" onClick={() => setF({ ...f, sections: f.sections.map((x, i) => (i === si ? { ...x, params: x.params.filter((_, j) => j !== pi) } : x)) })}>Remove parameter</button></div></details>)}
      <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setF({ ...f, sections: f.sections.map((x, i) => (i === si ? { ...x, params: [...x.params, { code: 'p' + Date.now().toString(36).slice(-4), name: '', description: '', weight: 0, fatal: false, options: ['Y', 'N', 'NA'], guideY: '', guideN: '', guideNA: '' }] } : x)) })}>Add parameter</button></section>)}
    <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setF({ ...f, sections: [...f.sections, { name: 'New section', params: [] }] })}>Add section</button>
    <div className="err" role="alert">{error}</div>
    <div className="actions"><button className="btn" disabled={pending} onClick={() => save(false)}>Save as draft version</button><button className="btn primary" disabled={pending} onClick={() => save(true)}>Save and make active</button></div>
  </div>);
}
