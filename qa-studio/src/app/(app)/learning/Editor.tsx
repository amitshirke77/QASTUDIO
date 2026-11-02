'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Quiz } from '@/db/schema';
import { saveLearning, previewAudience, type ItemInput } from '@/app/actions/learning';
import { toast } from '@/components/client';
import QuizBuilder from '@/components/quiz/QuizBuilder';
import { AttachmentsEditor, type FileMeta } from '@/components/learning/Attachments';
type D = { agents: { id: string; name: string; lob: string }[]; tls: { id: string; name: string }[]; forms: { id: string; name: string; sections: { name: string; params: { code: string; name: string }[] }[] }[] };

export default function Editor({ init, data, initFiles = [] }: { init: ItemInput; data: D; initFiles?: FileMeta[] }) {
  const [d, setD] = useState<ItemInput>(init); const router = useRouter(); const [files, setFiles] = useState<FileMeta[]>(initFiles);
  const [recips, setRecips] = useState<{ id: string; name: string }[]>([]); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const aud = d.audience;
  useEffect(() => { const h = setTimeout(() => previewAudience(aud, d.params).then(setRecips).catch(() => setRecips([])), 250); return () => clearTimeout(h); }, [JSON.stringify(aud), d.params.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async (publish: boolean) => { setErr(''); setBusy(true); const r = await saveLearning({ ...d, files: files.map((f) => f.id) }, publish); setBusy(false); if (!r.ok) { setErr(r.error); toast(r.error); window.scrollTo({ top: 0, behavior: 'smooth' }); return; } toast(publish ? `Published to ${recips.length} agents` : 'Draft saved'); router.push(publish ? `/learning/${(r.data as { id: string }).id}` : '/learning?tab=Draft'); router.refresh(); };
  const setAud = (a: Partial<ItemInput['audience']>) => setD({ ...d, audience: { ...aud, ...a } });
  return (<>
    <div className="page-head"><div><div className="eyebrow">{d.id ? 'Edit draft' : 'New'}</div><h1>{d.type === 'JIT' ? 'JIT training' : 'Briefing note'}</h1><p>{d.type === 'JIT' ? 'A short, focused training on something agents are getting wrong now. Link it to the parameters it fixes so you can see whether it worked.' : 'A process or policy update agents must read and accept before a set date.'}</p></div>
      <div className="actions"><button className="btn" onClick={() => router.push('/learning')}>Cancel</button><button className="btn" disabled={busy} onClick={() => save(false)}>Save draft</button><button className="btn primary" disabled={busy} onClick={() => save(true)}>Publish to {recips.length} agent{recips.length === 1 ? '' : 's'}</button></div></div>
    <div className="err" id="ldErr" role="alert" style={{ marginBottom: 8 }}>{err}</div>
    <div className="audit-layout"><div className="stack">
      <section className="card stack"><div className="form-grid">
        <div className="field"><label htmlFor="ld_type">Type</label><select id="ld_type" value={d.type} onChange={(e) => setD({ ...d, type: e.target.value as 'JIT' })}><option value="JIT">JIT training</option><option value="Briefing">Briefing note</option></select></div>
        <div className="field span2"><label htmlFor="ld_title">Title <span className="req">*</span></label><input id="ld_title" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="e.g. Hold etiquette: Permission, Time, Return" /></div>
        <div className="field"><label htmlFor="ld_due">Accept by</label><input type="date" id="ld_due" value={d.due || ''} onChange={(e) => setD({ ...d, due: e.target.value })} /></div></div>
        <div className="field"><label htmlFor="ld_body">Content <span className="req">*</span></label><textarea id="ld_body" rows={12} value={d.body} onChange={(e) => setD({ ...d, body: e.target.value })} placeholder="What changes, what agents must do, and an example script. Line breaks are kept." /></div>
      </section>
      <AttachmentsEditor files={files} onChange={setFiles} />
      <section className="card stack"><div><h2>Linked parameters</h2><p className="muted small" style={{ margin: '4px 0 0' }}>Optional for briefings. For a JIT training, pick the parameters it should improve: the audience can target agents who missed them, quiz questions can be suggested from them, and reports compare the “No” rate before and after.</p></div>
        {data.forms.map((f) => <details key={f.id} className="lrn-params" open={f.sections.some((s) => s.params.some((p) => d.params.includes(p.code)))}><summary><b>{f.name}</b> <span className="muted small">{f.sections.flatMap((s) => s.params).filter((p) => d.params.includes(p.code)).length} selected</span></summary>
          {f.sections.map((s) => <div key={s.name} className="lrn-psec"><div className="eyebrow">{s.name}</div>{s.params.map((p) => <label key={p.code} className="check small"><input type="checkbox" checked={d.params.includes(p.code)} onChange={(e) => setD({ ...d, params: e.target.checked ? [...new Set([...d.params, p.code])] : d.params.filter((x) => x !== p.code) })} /> {p.name}</label>)}</div>)}</details>)}
      </section>
      <QuizBuilder quiz={d.quiz as Quiz | null} setQuiz={(q) => setD({ ...d, quiz: q })} params={d.params} />
    </div>
    <aside className="score-pane"><div className="pane-card stack" style={{ gap: 12 }}><div className="eyebrow">Audience</div>
      <div className="field"><label htmlFor="ld_aud">Send to</label><select id="ld_aud" value={aud.kind} onChange={(e) => { const k = e.target.value as ItemInput['audience']['kind']; setAud({ kind: k, value: k === 'lob' ? 'Tripstacc' : k === 'team' ? data.tls[0]?.id : '' }); }}><option value="all">All agents</option><option value="lob">Agents in an LOB</option><option value="team">A TL&apos;s team</option><option value="agents">Selected agents</option><option value="missed">Agents who missed the linked parameters</option></select></div>
      {aud.kind === 'lob' && <div className="field"><label htmlFor="ld_lob">LOB</label><select id="ld_lob" value={aud.value} onChange={(e) => setAud({ value: e.target.value })}><option>Tripstacc</option><option>Shopstacc</option></select></div>}
      {aud.kind === 'team' && <div className="field"><label htmlFor="ld_tl">Team leader</label><select id="ld_tl" value={aud.value} onChange={(e) => setAud({ value: e.target.value })}>{data.tls.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>}
      {aud.kind === 'missed' && <div className="field"><label htmlFor="ld_days">Missed in the last (days)</label><input id="ld_days" type="number" min={1} max={180} value={aud.days || 30} onChange={(e) => setAud({ days: +e.target.value || 30 })} /></div>}
      {aud.kind === 'agents' && <div className="stack" style={{ gap: 2, maxHeight: 260, overflow: 'auto' }}>{data.agents.map((a) => <label key={a.id} className="check small"><input type="checkbox" checked={(aud.agents || []).includes(a.id)} onChange={(e) => setAud({ agents: e.target.checked ? [...(aud.agents || []), a.id] : (aud.agents || []).filter((x) => x !== a.id) })} /> {a.name} <span className="muted">{a.lob}</span></label>)}</div>}
      <div className="lrn-recips"><b>{recips.length} agent{recips.length === 1 ? '' : 's'}</b> will receive this{recips.length ? ':' : '.'}<div className="muted small">{recips.map((r) => r.name).join(', ')}</div></div>
      <p className="muted small" style={{ margin: 0 }}>Publishing notifies each agent in the app, by email and on Teams. The audience is fixed when you publish.</p></div></aside></div>
  </>);
}
