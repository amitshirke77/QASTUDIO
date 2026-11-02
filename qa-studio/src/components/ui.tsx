import Link from 'next/link';
import { pct, scls } from '@/lib/util';
export { pct, scls };
export function PageHead({ title, eyebrow, sub, actions, logo }: { title: string; eyebrow?: string; sub?: React.ReactNode; actions?: React.ReactNode; logo?: React.ReactNode }) {
  return <div className="page-head"><div>{logo && <div style={{ marginBottom: 8 }}>{logo}</div>}{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{sub && <p>{sub}</p>}</div>{actions && <div className="actions">{actions}</div>}</div>;
}
export function Kpi({ label, value, cls, sub, href }: { label: string; value: React.ReactNode; cls?: string; sub?: React.ReactNode; href?: string }) {
  const inner = <><span className="l">{label}</span><span className={'v ' + (cls || '')}>{value}</span>{sub != null && <span className="muted small">{sub}</span>}</>;
  return href ? <Link className="kpi click" href={href} style={{ textDecoration: 'none' }}>{inner}</Link> : <div className="kpi">{inner}</div>;
}
export const Score = ({ v, fatal }: { v: number | null | undefined; fatal?: boolean }) => <span className={'score ' + (fatal ? 's-bad' : scls(v))}>{pct(v)}</span>;
export const Chip = ({ children, tone }: { children: React.ReactNode; tone?: string }) => <span className={'chip ' + (tone || '')}>{children}</span>;
const ST: Record<string, string> = { 'Pending acknowledgement': 'warn', Acknowledged: 'good', Disputed: 'bad', 'Dispute resolved': 'acc' };
export const Status = ({ s }: { s: string }) => <span className={'chip ' + (ST[s] || '')}>{s}</span>;
export const Empty = ({ children }: { children: React.ReactNode }) => <div className="card empty">{children}</div>;
