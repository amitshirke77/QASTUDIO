import path from 'node:path';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema';

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * DATABASE_URL
 *   postgres://...        -> Supabase (use the transaction pooler, port 6543) or any Postgres
 *   pglite:./.pglite      -> embedded Postgres (WASM) on disk, for local development with no setup
 *   (unset)               -> same as pglite:./.pglite, except on Vercel where it is an error
 */
const g = globalThis as unknown as { __db?: DB };

function make(): DB {
  if (!process.env.DATABASE_URL && process.env.VERCEL)
    throw new Error('DATABASE_URL is not set. Add the Supabase transaction pooler connection string in Vercel › Settings › Environment Variables.');
  const url = process.env.DATABASE_URL || 'pglite:./.pglite';
  if (url.startsWith('pglite:')) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PGlite } = require('@electric-sql/pglite');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { drizzle } = require('drizzle-orm/pglite');
    const dir = url.slice('pglite:'.length);
    const client = dir === 'memory' ? new PGlite() : new PGlite(path.resolve(process.cwd(), dir));
    return drizzle(client, { schema }) as DB;
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const postgres = require('postgres');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { drizzle } = require('drizzle-orm/postgres-js');
  // prepare: false is required by Supabase's transaction pooler (Supavisor); keep the pool small on serverless
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const client = postgres(url, { prepare: false, max: Number(process.env.DB_POOL_MAX || 3), idle_timeout: 20, connect_timeout: 15, ssl: local ? false : 'require' });
  return drizzle(client, { schema }) as DB;
}

export const db: DB = g.__db ?? (g.__db = make());
export { schema };
