import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, schema as t } from '@/db';
import { requireUser } from '@/lib/auth';
import Editor from '../../Editor';
import { editorData } from '../../editorData';
import { filesFor } from '@/lib/learningFiles';
export default async function EditLearning({ params }: { params: { id: string } }) {
  const u = await requireUser('learning.create');
  const [it] = await db.select().from(t.learningItems).where(eq(t.learningItems.id, params.id));
  if (!it || it.status !== 'Draft') notFound();
  return <Editor data={await editorData(u)} initFiles={await filesFor(it.id)} init={{ id: it.id, type: it.type as 'JIT', title: it.title, body: it.body, params: it.params, audience: it.audience, due: it.due, quiz: it.quiz ?? null }} />;
}
