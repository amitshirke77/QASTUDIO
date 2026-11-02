'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveCustomReport, deleteCustomReport } from '@/app/actions/ops';
import { Modal, useAction } from '@/components/client';
type CR = { id: string; name: string; purpose: string; cols: string; filters: string; audience: string; freq: string };
export function CustomReportButtons({ edit }: { edit?: CR }) {
  const [open, setOpen] = useState(false); const { run, pending, error } = useAction(); const router = useRouter();
  const [v, setV] = useState<Omit<CR, 'id'>>(edit || { name: '', purpose: '', cols: '', filters: '', audience: '', freq: 'Monthly' });
  const f = (k: keyof Omit<CR, 'id'>) => ({ value: v[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value }) });
  return (<>
    {edit ? <span className="actions"><button className="btn sm" onClick={() => setOpen(true)}>Edit</button><button className="btn sm danger" onClick={() => window.confirm('Remove this custom report?') && run(() => deleteCustomReport(edit.id), { success: 'Removed', then: () => router.push('/reports') })}>Remove</button></span>
      : <button className="btn sm" style={{ margin: '6px 8px 0' }} onClick={() => setOpen(true)}>Add a custom report</button>}
    {open && <Modal title={edit ? 'Edit custom report' : 'Add a custom report'} onClose={() => setOpen(false)} foot={<><button className="btn" onClick={() => setOpen(false)}>Cancel</button><button className="btn primary" disabled={pending} onClick={() => run(() => saveCustomReport({ ...v, id: edit?.id }), { success: 'Saved', then: (d) => { setOpen(false); router.push('/reports?r=' + (d as { id: string }).id); } })}>{edit ? 'Save' : 'Add to reports'}</button></>}>
      <div className="field"><label htmlFor="cr_n">Report name</label><input id="cr_n" {...f('name')} placeholder="e.g. CUSTCAP monthly quality pack" /></div>
      <div className="field"><label htmlFor="cr_p">Purpose</label><textarea id="cr_p" rows={2} {...f('purpose')} /></div>
      <div className="field"><label htmlFor="cr_c">Metrics and columns</label><textarea id="cr_c" rows={3} {...f('cols')} placeholder="One per line" /></div>
      <div className="grid g2"><div className="field"><label htmlFor="cr_f">Filters and slices</label><input id="cr_f" {...f('filters')} /></div><div className="field"><label htmlFor="cr_a">Who sees it</label><input id="cr_a" {...f('audience')} /></div></div>
      <div className="field"><label htmlFor="cr_fr">Frequency</label><select id="cr_fr" {...f('freq')}>{['Daily', 'Weekly', 'Monthly', 'Quarterly', 'On demand'].map((x) => <option key={x}>{x}</option>)}</select></div>
      <div className="err" role="alert">{error}</div>
    </Modal>}
  </>);
}
