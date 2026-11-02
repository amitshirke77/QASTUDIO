import { requireUser } from '@/lib/auth';
import { addDays, today } from '@/lib/dates';
import Editor from '../Editor';
import { editorData } from '../editorData';
export default async function NewLearning({ searchParams }: { searchParams: { type?: string } }) {
  const u = await requireUser('learning.create');
  const type = searchParams.type === 'Briefing' ? 'Briefing' : 'JIT';
  return <Editor data={await editorData(u)} init={{ type, title: '', body: '', params: [], audience: type === 'JIT' ? { kind: 'missed', days: 30, params: [] } : { kind: 'lob', value: 'Tripstacc' }, due: addDays(today(), 3), quiz: null }} />;
}
