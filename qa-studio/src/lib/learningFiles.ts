import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db, schema as t } from '@/db';
import { can, type SessionUser } from './rbac';

import { INLINE, FILE_TYPES, MAX_FILE_BYTES, MAX_FILES, ACCEPT, extOf, fsize } from './fileTypes';
export { INLINE, FILE_TYPES, MAX_FILE_BYTES, MAX_FILES, ACCEPT, extOf, fsize };
export type FileMeta = { id: string; name: string; type: string; size: number };

const meta = { id: t.learningFiles.id, name: t.learningFiles.name, type: t.learningFiles.type, size: t.learningFiles.size, itemId: t.learningFiles.itemId };
export async function filesFor(itemId: string): Promise<FileMeta[]> {
  return (await db.select(meta).from(t.learningFiles).where(eq(t.learningFiles.itemId, itemId))).map(({ itemId: _i, ...m }) => m); // eslint-disable-line @typescript-eslint/no-unused-vars
}
/** Point the item at exactly these files: attach new uploads by this user, detach and delete the rest. */
export async function syncFiles(itemId: string, ids: string[], userId: string) {
  const cur = await db.select(meta).from(t.learningFiles).where(eq(t.learningFiles.itemId, itemId));
  const drop = cur.filter((f) => !ids.includes(f.id)).map((f) => f.id);
  if (drop.length) await db.delete(t.learningFiles).where(inArray(t.learningFiles.id, drop));
  const add = ids.filter((id) => !cur.some((f) => f.id === id));
  if (add.length) await db.update(t.learningFiles).set({ itemId }).where(and(inArray(t.learningFiles.id, add), isNull(t.learningFiles.itemId), eq(t.learningFiles.uploadedBy, userId)));
}
/** Staff who create learning can open any file; an agent only files of items assigned to them. */
export async function canOpen(u: SessionUser, itemId: string | null, uploadedBy: string) {
  if (!itemId) return uploadedBy === u.id;
  if (can(u.role, 'learning.create')) return true;
  if (u.role !== 'agent') return false;
  const [it] = await db.select({ status: t.learningItems.status }).from(t.learningItems).where(eq(t.learningItems.id, itemId));
  if (!it || it.status === 'Draft') return false;
  const a = await db.select().from(t.learningAssignments).where(and(eq(t.learningAssignments.itemId, itemId), eq(t.learningAssignments.agentId, u.id)));
  return a.length > 0;
}
