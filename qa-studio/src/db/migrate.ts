import path from 'node:path';
import fs from 'node:fs';

async function main() {
  // Migrations need a session connection: Supabase's session pooler (port 5432) or the direct connection, in DIRECT_URL.
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL || 'pglite:./.pglite';
  if (/:6543\//.test(url)) throw new Error('Set DIRECT_URL to the Supabase session pooler (port 5432) to run migrations; the transaction pooler (6543) cannot.');
  const folder = path.resolve(process.cwd(), 'drizzle');
  // re-applied after every migration so tables added later are locked down too (idempotent)
  const lockdown = fs.readFileSync(path.join(folder, '0001_supabase_lockdown.sql'), 'utf8');
  if (url.startsWith('pglite:')) {
    const { PGlite } = await import('@electric-sql/pglite');
    const { drizzle } = await import('drizzle-orm/pglite');
    const { migrate } = await import('drizzle-orm/pglite/migrator');
    const dir = path.resolve(process.cwd(), url.slice(7));
    fs.mkdirSync(dir, { recursive: true });
    const client = new PGlite(dir);
    await migrate(drizzle(client), { migrationsFolder: folder });
    await client.exec(lockdown);
    await client.close();
  } else {
    const postgres = (await import('postgres')).default;
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const { migrate } = await import('drizzle-orm/postgres-js/migrator');
    const client = postgres(url, { max: 1, ssl: /@(localhost|127\.0\.0\.1)[:/]/.test(url) ? false : 'require', onnotice: () => {} });
    await migrate(drizzle(client), { migrationsFolder: folder });
    await client.unsafe(lockdown);
    await client.end();
  }
  console.log('Migrations applied; row level security is on for every table');
}
main().catch((e) => { console.error(e); process.exit(1); });
