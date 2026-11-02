import { NextResponse, type NextRequest } from 'next/server';
import { db, schema as t } from '@/db';
import { currentUser } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { activeForms, getForm, getUsers } from '@/lib/data';
import { today } from '@/lib/dates';
import { buildImportSample } from '@/lib/importSample';
export const dynamic = 'force-dynamic';

/** GET /api/import/sample?formId= — a sample .xlsx for the past-audit importer, built for that form. */
export async function GET(req: NextRequest) {
  const u = await currentUser(); if (!u) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  if (!can(u.role, 'import')) return NextResponse.json({ error: 'Not allowed.' }, { status: 403 });
  const id = req.nextUrl.searchParams.get('formId');
  const form = (id && (await getForm(id))) || (await activeForms())[0]; if (!form) return NextResponse.json({ error: 'No form found.' }, { status: 404 });
  const users = await getUsers(); const customers = (await db.select().from(t.customers)).filter((c) => c.active).map((c) => c.name); const products = await db.select().from(t.products);
  const { name, buf } = buildImportSample(form, users, customers, products, today());
  return new NextResponse(new Uint8Array(buf), { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store' } });
}
