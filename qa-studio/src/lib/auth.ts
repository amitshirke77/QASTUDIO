import type { NextAuthOptions } from 'next-auth';
import { getServerSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import AzureADProvider from 'next-auth/providers/azure-ad';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { and, eq, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db, schema as t } from '@/db';
import { can, type Cap, type Role, type SessionUser } from './rbac';
import { uid } from './util';
import { matchOrg, matchGoogle, accountFits, isMultiTenant, list } from './sso';

/** AZURE_AD_TENANT_ID: the zipstacc tenant ID (clients sign in as B2B guests) or `organizations` (clients sign in from their own tenant). */
export const ssoEnabled = !!(process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET && process.env.AZURE_AD_TENANT_ID);
/** Google sign-in (Google Workspace accounts only) when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set. */
export const googleEnabled = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

/* naive in-memory throttle per username (use a shared store such as Upstash in multi-instance production) */
const fails = new Map<string, { n: number; until: number }>();

async function log(userId: string | null, text: string) { await db.insert(t.activityLog).values({ id: uid('lg'), userId, text }); }

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 12 * 3600 },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'Password',
      credentials: { username: { label: 'Username', type: 'text' }, password: { label: 'Password', type: 'password' } },
      async authorize(c) {
        const username = String(c?.username || '').trim(); const password = String(c?.password || '');
        if (!username || !password) return null;
        const k = username.toLowerCase(); const f = fails.get(k);
        if (f && f.until > Date.now()) throw new Error('Too many attempts. Try again in a few minutes.');
        const [u] = await db.select().from(t.users).where(sql`lower(${t.users.username}) = ${k}`).limit(1);
        const manual = await db.select().from(t.settings).where(eq(t.settings.key, 'sso')).then((r) => (r[0]?.value as { allowManual?: boolean })?.allowManual !== false);
        const ok = u && u.active && u.authPassword && u.passwordHash && (manual || u.role === 'client' || u.role === 'admin') && (await bcrypt.compare(password, u.passwordHash));
        if (!ok) { const n = (f?.n || 0) + 1; fails.set(k, { n, until: n >= 5 ? Date.now() + 10 * 60e3 : 0 }); return null; }
        fails.delete(k); await log(u.id, `${u.name} signed in (password)`);
        return { id: u.id, name: u.name, email: u.email ?? undefined };
      },
    }),
    ...(ssoEnabled ? [AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!, clientSecret: process.env.AZURE_AD_CLIENT_SECRET!, tenantId: process.env.AZURE_AD_TENANT_ID!,
      authorization: { params: { scope: 'openid profile email User.Read' } },
    })] : []),
    ...(googleEnabled ? [GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // offer only work accounts in the account chooser when a single Workspace domain is set
      authorization: { params: { prompt: 'select_account', ...(process.env.GOOGLE_HD ? { hd: process.env.GOOGLE_HD } : {}) } },
    })] : []),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      const provider = account?.provider;
      if (provider !== 'azure-ad' && provider !== 'google') return true;
      const google = provider === 'google', via = google ? 'Google' : 'Microsoft 365';
      const p = (profile || {}) as { tid?: string; oid?: string; sub?: string; email?: string; email_verified?: boolean; hd?: string; preferred_username?: string; groups?: string[] };
      // the account's stable identity: Entra tenant + object ID, or the Google subject ID
      const tid = google ? '' : String(p.tid || ''), oid = google ? '' : String(p.oid || ''), gsub = google ? String(p.sub || account?.providerAccountId || '') : '';
      // 1. Already linked to this account: the strongest match.
      const [linked] = google ? (gsub ? await db.select().from(t.users).where(eq(t.users.googleSub, gsub)).limit(1) : [])
        : (tid && oid ? await db.select().from(t.users).where(and(eq(t.users.ssoTid, tid), eq(t.users.ssoOid, oid))).limit(1) : []);
      if (linked) {
        if (!linked.active || !linked.authSso) return '/login?error=Disabled';
        await log(linked.id, `${linked.name} signed in (${via})`);
        (user as { id: string }).id = linked.id; return true;
      }
      // 2. Which organization is this? Staff domains (e.g. zipstacc.com) or a client's domains (e.g. customer-capital.com).
      const cfg = (await db.select().from(t.settings).where(eq(t.settings.key, 'sso')))[0]?.value as { domains?: string; tenantIds?: string; groups?: { g: string; role: Role; companyId?: string | null }[] } | undefined;
      const clients = await db.select().from(t.clients);
      const staff = { domains: list(cfg?.domains || process.env.ALLOWED_EMAIL_DOMAINS), tenantIds: list(cfg?.tenantIds || process.env.STAFF_TENANT_IDS) };
      const m = google ? matchGoogle({ email: p.email || user.email || undefined, email_verified: p.email_verified, hd: p.hd }, staff, clients)
        : matchOrg({ tid, oid, upn: p.preferred_username, email: p.email || user.email || undefined }, staff, clients, isMultiTenant());
      if (!m.ok) { await log(null, `${via} sign-in refused (${m.error}) for ${p.preferred_username || p.email || 'unknown'}`); return '/login?error=' + m.error; }
      // 3. Existing account with that email: it must belong to the same organization; link it to this account.
      const [u] = await db.select().from(t.users).where(sql`lower(${t.users.email}) = ${m.email}`).limit(1);
      if (u) {
        if (!u.active || !u.authSso) return '/login?error=Disabled';
        if (!accountFits(u, m.org)) return '/login?error=Mismatch';
        if (google ? u.googleSub && u.googleSub !== gsub : u.ssoOid && u.ssoOid !== oid) return '/login?error=Mismatch';
        if (google && gsub && !u.googleSub) await db.update(t.users).set({ googleSub: gsub }).where(eq(t.users.id, u.id));
        if (!google && tid && oid && !u.ssoOid) await db.update(t.users).set({ ssoTid: tid, ssoOid: oid }).where(eq(t.users.id, u.id));
        await log(u.id, `${u.name} signed in (${via})`);
        (user as { id: string }).id = u.id; return true;
      }
      // 4. First sign-in.
      const id = uid('u'); const name = user.name || m.email;
      const link = google ? { googleSub: gsub || null } : { ssoTid: tid || null, ssoOid: oid || null };
      if (m.org.kind === 'client') {
        // Client stakeholders get a read-only client login only when the client allows it; otherwise an admin adds them first.
        if (!m.org.autoProvision) return '/login?error=NoAccount';
        await db.insert(t.users).values({ id, name, role: 'client', email: m.email, username: m.email, authSso: true, authPassword: false, clientId: m.org.clientId, companyId: m.org.companyId, ...link });
        await log(id, `${name} was added as a client stakeholder on first ${via} sign-in`);
        (user as { id: string }).id = id; return true;
      }
      // Staff: role and company from Entra ID group membership (Admin › Login & SSO). Google carries no groups, so staff
      // using Google must be added under Users first.
      const groups = (p.groups || []).map(String);
      const order: Role[] = ['admin', 'manager', 'qalead', 'auditor', 'tl', 'agent'];
      const hits = (cfg?.groups || []).filter((g) => groups.includes(g.g));
      const role = order.find((r) => hits.some((g) => g.role === r));
      if (!role) return '/login?error=' + (google ? 'NoAccount' : 'NoRole');
      const companyId = hits.find((g) => g.role === role)?.companyId ?? null;
      await db.insert(t.users).values({ id, name, role, email: m.email, username: m.email.split('@')[0] + '.' + id.slice(-4), authSso: true, authPassword: false, lob: null, companyId, ...link });
      await log(id, `${name} was added on first ${via} sign-in as ${role}`);
      (user as { id: string }).id = id; return true;
    },
    async jwt({ token, user }) {
      if (user) { token.uid = (user as { id: string }).id; token.checked = 0; }
      if (token.uid && Date.now() - Number(token.checked || 0) > 60e3) {
        const [u] = await db.select().from(t.users).where(eq(t.users.id, String(token.uid))).limit(1);
        if (!u || !u.active) return { ...token, uid: null };
        Object.assign(token, { role: u.role, name: u.name, lob: u.lob, tlId: u.tlId, companyId: u.companyId, clientId: u.clientId, checked: Date.now() });
      }
      return token;
    },
    async session({ session, token }) {
      (session as unknown as { user: SessionUser | null }).user = token.uid ? { id: String(token.uid), name: String(token.name), role: token.role as Role, lob: (token.lob as string) || null, tlId: (token.tlId as string) || null, companyId: (token.companyId as string) || null, clientId: (token.clientId as string) || null } : null;
      return session;
    },
  },
};

export async function currentUser(): Promise<SessionUser | null> {
  const s = await getServerSession(authOptions);
  return ((s as unknown as { user?: SessionUser | null })?.user) || null;
}
/** For pages and actions: signed-in user, optionally with a capability. */
export async function requireUser(cap?: Cap): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) redirect('/login');
  if (cap && !can(u.role, cap)) redirect('/');
  return u;
}
export async function requireRole(...roles: Role[]) { const u = await requireUser(); if (!roles.includes(u.role)) redirect('/'); return u; }
