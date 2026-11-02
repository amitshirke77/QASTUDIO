import { randomBytes } from 'node:crypto';
export const uid = (p: string) => p + randomBytes(6).toString('base64url');
export const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
export const pct = (v: number | null | undefined) => (v == null || isNaN(v) ? '—' : v.toFixed(1) + '%');
export const scls = (v: number | null | undefined) => (v == null ? '' : v >= 90 ? 's-good' : v >= 80 ? 's-warn' : 's-bad');
export function groupBy<T, K>(arr: T[], f: (x: T) => K) { const m = new Map<K, T[]>(); arr.forEach((x) => { const k = f(x); const a = m.get(k); if (a) a.push(x); else m.set(k, [x]); }); return m; }
export const initials = (n: string) => n.split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase();
