'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from './client';
export type Col = [string, string, ('num' | 'pct' | 'delta' | 'date' | 'dec')?];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fdate = (s: string) => { const [y, m, d] = s.slice(0, 10).split('-'); return `${+d} ${MON[+m - 1]} ${y}`; };
const scls = (v: number) => (v >= 90 ? 's-good' : v >= 80 ? 's-warn' : 's-bad');
function cell(v: unknown, t?: string) {
  if (v == null || v === '' || (typeof v === 'number' && isNaN(v))) return <span className="muted">—</span>;
  if (t === 'pct') return <span className={'score ' + scls(+v)}>{(+v).toFixed(1)}%</span>;
  if (t === 'delta') return <span className={'score ' + (+v > 0.05 ? 's-good' : +v < -0.05 ? 's-bad' : '')}>{+v > 0 ? '+' : ''}{(+v).toFixed(1)}</span>;
  if (t === 'num') return <span className="mono">{Math.round(+v * 10) / 10}</span>;
  if (t === 'dec') return <span className="mono">{(+v).toFixed(1)}</span>;
  if (t === 'date') return fdate(String(v));
  return String(v);
}
export default function DataTable({ cols, rows, sort, dir = -1, maxHeight = 640, title }: { cols: Col[]; rows: Record<string, unknown>[]; sort?: string; dir?: 1 | -1; maxHeight?: number; title?: string }) {
  const [sk, setSk] = useState({ k: sort || cols[0]?.[0], dir });
  const router = useRouter();
  const sorted = useMemo(() => rows.slice().sort((a, b) => { const x = a[sk.k] as number | string | null, y = b[sk.k] as number | string | null; if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (x < y ? -1 : x > y ? 1 : 0) * sk.dir; }), [rows, sk]);
  const copy = () => {
    const tsv = [cols.map((c) => c[1]).join('\t'), ...sorted.map((r) => cols.map(([k]) => { const v = r[k]; return v == null ? '' : typeof v === 'number' ? +v.toFixed(2) : String(v).replace(/\s+/g, ' '); }).join('\t'))].join('\n');
    navigator.clipboard.writeText(tsv).then(() => toast(`Copied ${sorted.length} rows. Paste into Excel.`), () => toast('Copy failed: your browser blocked clipboard access.'));
  };
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '0 0 8px' }}>{title ? <h3>{title}</h3> : <span />}<span className="actions"><span className="muted small">{rows.length} row{rows.length === 1 ? '' : 's'}</span><button className="btn sm" onClick={copy}>Copy table</button></span></div>
      {rows.length ? <div className="tbl-wrap" style={{ maxHeight, overflow: 'auto' }}><table className="tbl"><thead><tr>{cols.map(([k, l, t]) => <th key={k} className={t && t !== 'date' ? 'r' : ''}><button className="rc-sort" onClick={() => setSk((s) => ({ k, dir: s.k === k ? (-s.dir as 1 | -1) : -1 }))}>{l}{sk.k === k ? (sk.dir > 0 ? ' ▲' : ' ▼') : ''}</button></th>)}</tr></thead>
        <tbody>{sorted.map((r, i) => <tr key={i} className={r._href ? 'click' : ''} onClick={() => r._href && router.push(String(r._href))}>{cols.map(([k, , t]) => <td key={k} className={t && t !== 'date' ? 'r' : ''}>{cell(r[k], t)}</td>)}</tr>)}</tbody></table></div> : <div className="empty">No rows for these filters.</div>}
    </div>
  );
}
