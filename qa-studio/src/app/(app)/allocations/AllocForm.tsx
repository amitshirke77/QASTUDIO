'use client';
import { useState } from 'react';
import { createAllocations } from '@/app/actions/ops';
import { useAction } from '@/components/client';
export default function AllocForm({ agents, auditors }: { agents: { id: string; name: string; lob: string }[]; auditors: { id: string; name: string }[] }) {
  const { run, pending, error } = useAction();
  const t = new Date(); t.setDate(t.getDate() + 2);
  const [v, setV] = useState({ agentIds: [] as string[], auditorId: '', channel: 'Call' as 'Call' | 'Email', count: 1, dueDate: t.toISOString().slice(0, 10), note: '' });
  return (<div className="card stack"><h3>New allocation</h3>
    <div className="form-grid">
      <div className="field"><label htmlFor="al_a">Auditor</label><select id="al_a" value={v.auditorId} onChange={(e) => setV({ ...v, auditorId: e.target.value })}><option value="">Select</option>{auditors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
      <div className="field"><label htmlFor="al_c">Type</label><select id="al_c" value={v.channel} onChange={(e) => setV({ ...v, channel: e.target.value as 'Call' })}><option>Call</option><option>Email</option></select></div>
      <div className="field"><label htmlFor="al_n">Audits per agent</label><input id="al_n" type="number" min={1} max={20} value={v.count} onChange={(e) => setV({ ...v, count: +e.target.value || 1 })} /></div>
      <div className="field"><label htmlFor="al_d">Due</label><input id="al_d" type="date" value={v.dueDate} onChange={(e) => setV({ ...v, dueDate: e.target.value })} /></div>
      <div className="field span2"><label htmlFor="al_note">Note</label><input id="al_note" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} placeholder="e.g. focus on hold etiquette" /></div>
    </div>
    <div><div className="eyebrow" style={{ marginBottom: 6 }}>Agents ({v.agentIds.length} selected)</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>{agents.map((a) => <label key={a.id} className="check small"><input type="checkbox" checked={v.agentIds.includes(a.id)} onChange={(e) => setV({ ...v, agentIds: e.target.checked ? [...v.agentIds, a.id] : v.agentIds.filter((x) => x !== a.id) })} /> {a.name} <span className="muted">{a.lob}</span></label>)}</div></div>
    <div className="actions"><button className="btn primary" disabled={pending} onClick={() => run(() => createAllocations(v), { success: 'Allocated', then: () => setV({ ...v, agentIds: [] }) })}>Allocate</button><span className="err" role="alert">{error}</span></div>
  </div>);
}
