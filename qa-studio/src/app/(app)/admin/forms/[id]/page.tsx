import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getForm } from '@/lib/data';
import { PageHead } from '@/components/ui';
import FormEditor from './FormEditor';
export default async function EditForm({ params }: { params: { id: string } }) {
  await requireUser('admin.forms'); const f = await getForm(params.id); if (!f) notFound();
  return (<><PageHead eyebrow={`${f.channel} form · v${f.version} · ${f.status}`} title={f.name} sub="Change parameters, marks, fatal flags and the rating guidance. Saving creates a new version." />
    <FormEditor base={{ id: f.id, name: f.name, lobs: f.lobs, sections: f.sections.map((s) => ({ name: s.name, params: s.params.map((p) => ({ code: p.code, name: p.name, description: p.description, weight: p.weight, fatal: p.fatal, options: p.options as ('Y' | 'N' | 'NA')[], guideY: p.guideY, guideN: p.guideN, guideNA: p.guideNA })) })) }} /></>);
}
