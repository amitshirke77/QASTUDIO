export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TZ = process.env.APP_TIMEZONE || 'Asia/Kolkata';

/** Today's date (YYYY-MM-DD) in the operation's time zone. */
export function today(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function parseD(s: string) { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); }
export function isoD(dt: Date) { return dt.toISOString().slice(0, 10); }
export function addDays(s: string, n: number) { const d = parseD(s); d.setUTCDate(d.getUTCDate() + n); return isoD(d); }
/** Week runs Monday–Sunday; the week ending is the Sunday. */
export function weekEnding(s: string) { const dow = parseD(s).getUTCDay(); return addDays(s, (7 - dow) % 7); }
export function monthLabel(s: string) { const d = parseD(s); return `${MON[d.getUTCMonth()]}-${d.getUTCFullYear()}`; }
export function fdate(s?: string | Date | null) {
  if (!s) return '—';
  const iso = typeof s === 'string' ? s.slice(0, 10) : isoD(s);
  const d = parseD(iso); return `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
export function fdt(s?: string | Date | null) {
  if (!s) return '—';
  return new Intl.DateTimeFormat('en-IN', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(s));
}
export function monthsBetween(a: string, b: string) { const [y1, m1] = a.split('-').map(Number); const [y2, m2] = b.split('-').map(Number); return (y2 - y1) * 12 + (m2 - m1); }
export function prevMonths(cur: string, n: number) { const [y, m] = cur.split('-').map(Number); const out: string[] = []; for (let i = n; i >= 1; i--) { const d = new Date(Date.UTC(y, m - 1 - i, 1)); out.push(d.toISOString().slice(0, 7)); } return out; }
