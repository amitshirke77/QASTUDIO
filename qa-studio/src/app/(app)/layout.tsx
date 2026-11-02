import Link from 'next/link';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { scopeOf } from '@/lib/scope';
import { db, schema as t } from '@/db';
import { requireUser } from '@/lib/auth';
import { ROLES } from '@/lib/rbac';
import { navFor } from '@/lib/nav';
import { initials } from '@/lib/util';
import Rail from '@/components/Rail';
import UserMenu from '@/components/UserMenu';
import { Toaster } from '@/components/client';
import { CompanyLogo } from '@/components/CompanyLogo';
import { hierarchy } from '@/lib/scope';

export const dynamic = 'force-dynamic';

async function badges(u: Awaited<ReturnType<typeof requireUser>>) {
  const n = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n || 0;
  const cnt = sql<number>`count(*)::int`;
  const out: Record<string, number> = {};
  out.unread = await n(db.select({ n: cnt }).from(t.notifications).where(and(eq(t.notifications.userId, u.id), eq(t.notifications.read, false))));
  if (['admin', 'qalead', 'auditor'].includes(u.role)) { const sc = await scopeOf(u); out.disputes = sc && !sc.length ? 0 : await n(db.select({ n: cnt }).from(t.audits).where(and(eq(t.audits.status, 'Disputed'), ...(u.role === 'auditor' ? [eq(t.audits.auditorId, u.id)] : []), ...(sc ? [inArray(t.audits.clientId, sc)] : [])))); }
  if (u.role === 'auditor') out.queue = await n(db.select({ n: cnt }).from(t.allocations).where(and(eq(t.allocations.auditorId, u.id), eq(t.allocations.status, 'Pending'))));
  if (u.role === 'agent') out.mylearning = await n(db.select({ n: cnt }).from(t.learningAssignments).innerJoin(t.learningItems, eq(t.learningItems.id, t.learningAssignments.itemId)).where(and(eq(t.learningAssignments.agentId, u.id), eq(t.learningItems.status, 'Published'), sql`${t.learningAssignments.acceptedAt} is null`)));
  if (u.role === 'auditor' || u.role === 'qalead') {
    const open = await db.select().from(t.calibSessions).where(eq(t.calibSessions.status, 'Open'));
    let c = 0; for (const s of open.filter((s) => s.participants.includes(u.id))) { const items = await n(db.select({ n: cnt }).from(t.calibItems).where(eq(t.calibItems.sessionId, s.id))); const done = await n(db.select({ n: cnt }).from(t.calibScores).where(and(eq(t.calibScores.sessionId, s.id), eq(t.calibScores.userId, u.id)))); c += items - done; }
    out.calib = c;
  }
  return out;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  const b = await badges(u); const h = await hierarchy(u);
  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/" className="brand" style={{ textDecoration: 'none' }}><span className="brand-mark">QA</span>QA Studio</Link>
        <span className="co-logos" aria-label="Companies">{h.companies.map((c) => <CompanyLogo key={c.id} id={c.id} name={c.name} h={16} />)}</span>
        <div className="spacer" />
        <Link href="/notifications" className="iconbtn" aria-label={`Notifications, ${b.unread} unread`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
          {b.unread ? <span className="dot">{b.unread}</span> : null}
        </Link>
        <UserMenu name={u.name} role={ROLES[u.role]} initials={initials(u.name)} />
      </header>
      <Rail nav={navFor(u.role)} badges={b} />
      <main id="main">{children}</main>
      <Toaster />
    </div>
  );
}
