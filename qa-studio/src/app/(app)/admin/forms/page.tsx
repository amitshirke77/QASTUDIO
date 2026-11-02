import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getForms } from '@/lib/data';
import { ActionButton } from '@/components/client';
import { setFormStatus } from '@/app/actions/admin';
import { PageHead, Chip } from '@/components/ui';
export default async function Forms() {
  await requireUser('admin.forms'); const forms = await getForms();
  return (<><PageHead title="Forms" sub="Call and email forms mapped to LOBs. Editing saves a new version; audits keep the version they were scored on. Marks must total 100." />
    <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Form</th><th>Channel</th><th>Version</th><th>LOBs</th><th className="r">Parameters</th><th className="r">Fatal</th><th>Status</th><th></th></tr></thead><tbody>
      {forms.map((f) => { const ps = f.sections.flatMap((s) => s.params); return <tr key={f.id}><td><b>{f.name}</b></td><td>{f.channel}</td><td className="mono">v{f.version}</td><td>{f.lobs.join(', ')}</td><td className="r mono">{ps.length}</td><td className="r mono">{ps.filter((p) => p.fatal).length}</td><td><Chip tone={f.status === 'Active' ? 'good' : f.status === 'Draft' ? 'warn' : ''}>{f.status}</Chip></td><td className="r"><span className="actions"><Link className="btn sm" href={`/admin/forms/${f.id}`}>{f.status === 'Retired' ? 'View' : 'Edit as new version'}</Link>{f.status !== 'Active' && <ActionButton className="sm" label="Make active" confirm="Make this version active? The current active version of this form is retired." action={setFormStatus} args={[f.id, 'Active']} />}</span></td></tr>; })}
    </tbody></table></div></>);
}
