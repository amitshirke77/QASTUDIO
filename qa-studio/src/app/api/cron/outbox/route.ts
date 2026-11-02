import { NextResponse } from 'next/server';
import { flushOutbox } from '@/lib/notify';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  if (process.env.CRON_SECRET && req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return new NextResponse('Unauthorized', { status: 401 });
  return NextResponse.json(await flushOutbox());
}
