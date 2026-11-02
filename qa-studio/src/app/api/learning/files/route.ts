import { NextResponse, type NextRequest } from 'next/server';
import { db, schema as t } from '@/db';
import { currentUser } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { uid } from '@/lib/util';
import { FILE_TYPES, MAX_FILE_BYTES, extOf, fsize } from '@/lib/learningFiles';
export const dynamic = 'force-dynamic';

/** POST multipart `file` — upload an attachment for a JIT training or briefing note. It is attached to the item when the item is saved. */
export async function POST(req: NextRequest) {
  const u = await currentUser(); if (!u) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  if (!can(u.role, 'learning.create')) return NextResponse.json({ error: 'Not allowed.' }, { status: 403 });
  const fd = await req.formData().catch(() => null); const f = fd?.get('file');
  if (!f || typeof f === 'string') return NextResponse.json({ error: 'Choose a file.' }, { status: 400 });
  const type = FILE_TYPES[extOf(f.name)];
  if (!type) return NextResponse.json({ error: `${f.name}: this file type is not allowed. Use PDF, PowerPoint, Word, Excel, CSV, text, an image, audio or video.` }, { status: 400 });
  if (!f.size) return NextResponse.json({ error: `${f.name} is empty.` }, { status: 400 });
  if (f.size > MAX_FILE_BYTES) return NextResponse.json({ error: `${f.name} is ${fsize(f.size)}; the limit is ${fsize(MAX_FILE_BYTES)}. For larger files, such as videos, put a SharePoint or OneDrive link in the content.` }, { status: 413 });
  const name = f.name.replace(/[\\/\r\n"]/g, '_').slice(0, 180);
  const row = { id: uid('lf'), itemId: null, name, type, size: f.size, data: Buffer.from(await f.arrayBuffer()), uploadedBy: u.id };
  await db.insert(t.learningFiles).values(row);
  return NextResponse.json({ id: row.id, name, type, size: f.size });
}
