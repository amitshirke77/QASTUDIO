'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createCalibration } from '@/app/actions/calibration';
import { useAction } from '@/components/client';
export default function NewSession({ forms, audits, people }: { forms: { id: string; name: string }[]; audits: { id: string; caseId: string; formId: string; link: string; label: string }[]; people: { id: string; name: string }[] }) {
  const [v, setV] = useState({ title: '', formId: forms[0]?.id || '', due: '', participants: people.map((p) => p.id), items: [] as { auditId: string | null; caseId: string; link?: string }[] });
  const [cid, setCid] = useState(''), [lnk, setLnk] = useState(''); const { run, pending, error } = useAction(); const router = useRouter();
  const avail = audits.filter((a) => a.formId === v.formId);
  return (<div className="card stack">
    <div className="form-grid"><div className="field span2"><label htmlFor="cs_t">Session name</label><input id="cs_t" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="e.g. November call calibration" /></div>
      <div className="field"><label htmlFor="cs_f">Form</label><select id="cs_f" value={v.formId} onChange={(e) => setV({ ...v, formId: e.target.value, items: [] })}>{forms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
      <div className="field"><label htmlFor="cs_d">Score by</label><input id="cs_d" type="date" value={v.due} onChange={(e) => setV({ ...v, due: e.target.value })} /></div></div>
    <div><div className="eyebrow">Participants</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 6 }}>{people.map((p) => <label key={p.id} className="check small"><input type="checkbox" checked={v.participants.includes(p.id)} onChange={(e) => setV({ ...v, participants: e.target.checked ? [...v.participants, p.id] : v.participants.filter((x) => x !== p.id) })} /> {p.name}</label>)}</div></div>
    <div><div className="eyebrow">Interactions ({v.items.length}/5)</div><div className="stack" style={{ gap: 2, maxHeight: 260, overflow: 'auto', marginTop: 6 }}>{avail.map((a) => <label key={a.id} className="check small"><input type="checkbox" checked={v.items.some((x) => x.auditId === a.id)} disabled={!v.items.some((x) => x.auditId === a.id) && v.items.length >= 5} onChange={(e) => setV({ ...v, items: e.target.checked ? [...v.items, { auditId: a.id, caseId: a.caseId, link: a.link }] : v.items.filter((x) => x.auditId !== a.id) })} /> {a.label}</label>)}</div>
      <div className="inline-form" style={{ marginTop: 8 }}><div className="field"><label htmlFor="cs_c">Or add a case ID</label><input id="cs_c" value={cid} onChange={(e) => setCid(e.target.value)} /></div><div className="field" style={{ flex: 1 }}><label htmlFor="cs_l">Recording link</label><input id="cs_l" value={lnk} onChange={(e) => setLnk(e.target.value)} /></div><button className="btn sm" disabled={!cid.trim() || v.items.length >= 5} onClick={() => { setV({ ...v, items: [...v.items, { auditId: null, caseId: cid.trim(), link: lnk }] }); setCid(''); setLnk(''); }}>Add</button></div></div>
    <div className="err" role="alert">{error}</div>
    <div className="actions"><button className="btn primary" disabled={pending} onClick={() => run(() => createCalibration(v), { success: 'Session started; participants notified', then: (d) => router.push('/calibration/' + (d as { id: string }).id) })}>Start session</button></div>
  </div>);
}
