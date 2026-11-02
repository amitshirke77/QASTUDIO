import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, schema as t } from '@/db';
import { currentUser } from '@/lib/auth';
import { INLINE, canOpen } from '@/lib/learningFiles';
export const dynamic = 'force-dynamic';

/** GET — open or download an attachment; only people who can see the item get it. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const u = await currentUser(); if (!u) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const [f] = await db.select().from(t.learningFiles).where(eq(t.learningFiles.id, params.id));
  if (!f || !(await canOpen(u, f.itemId, f.uploadedBy))) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const inline = INLINE.has(f.type) && req.nextUrl.searchParams.get('download') !== '1';
  return new NextResponse(new Uint8Array(f.data), { headers: {
    'Content-Type': f.type, 'Content-Length': String(f.size), 'Cache-Control': 'private, no-store',
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${f.name.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(f.name)}`,
    'Content-Security-Policy': "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox",
  } });
}
