'use client';
import { useEffect, useState } from 'react';
import { Chart as C, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler, BarController, LineController } from 'chart.js';
import { Chart } from 'react-chartjs-2';
C.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler, BarController, LineController);

export type DS = { label: string; data: (number | null)[]; type?: 'line' | 'bar'; color?: number; dashed?: boolean; axis?: 'y' | 'y1'; fill?: boolean };
function palette() { const s = getComputedStyle(document.documentElement); return ['--c1', '--c2', '--c3', '--c4', '--c5', '--c6'].map((v) => s.getPropertyValue(v).trim() || '#0d6a64'); }

/** Mixed line/bar chart. pct=true draws a 0–100% axis that starts near the data. */
export default function QChart({ labels, sets, type = 'line', pct = true, height = 260, horizontal, stacked }: { labels: string[]; sets: DS[]; type?: 'line' | 'bar'; pct?: boolean; height?: number; horizontal?: boolean; stacked?: boolean }) {
  const [pal, setPal] = useState<string[] | null>(null);
  useEffect(() => { setPal(palette()); C.defaults.font.family = getComputedStyle(document.body).fontFamily; C.defaults.color = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim(); }, []);
  if (!pal) return <div style={{ height }} />;
  if (!labels.length) return <div className="empty" style={{ height, display: 'grid', placeItems: 'center' }}>No data for these filters.</div>;
  const vals = sets.filter((s) => (s.axis || 'y') === 'y').flatMap((s) => s.data).filter((x): x is number => x != null);
  const min = pct && vals.length ? Math.max(0, Math.floor((Math.min(...vals) - 5) / 10) * 10) : undefined;
  const data = { labels, datasets: sets.map((s, i) => { const col = pal[(s.color ?? i) % pal.length]; const t = s.type || type; return { type: t, label: s.label, data: s.data, borderColor: col, backgroundColor: t === 'bar' ? (s.axis === 'y1' ? col + '55' : col) : s.fill ? col + '22' : col, borderDash: s.dashed ? [6, 4] : undefined, tension: 0.3, cubicInterpolationMode: 'monotone' as const, spanGaps: true, pointRadius: labels.length > 30 ? 0 : 3, fill: !!s.fill, yAxisID: s.axis || 'y', borderRadius: 3, order: t === 'line' ? 1 : 2 }; }) };
  const ax = pct ? { suggestedMin: min, max: 100, ticks: { callback: (v: number | string) => v + '%' } } : { beginAtZero: true, ticks: { precision: 0 } };
  const options = {
    responsive: true, maintainAspectRatio: false, indexAxis: horizontal ? ('y' as const) : ('x' as const), interaction: { mode: 'index' as const, intersect: false },
    plugins: { legend: { labels: { boxWidth: 10, boxHeight: 10 } }, tooltip: { callbacks: { label: (c: { dataset: { label?: string; yAxisID?: string }; parsed: { x: number; y: number } }) => { const v = horizontal ? c.parsed.x : c.parsed.y; return `${c.dataset.label}: ${v == null ? '—' : pct && c.dataset.yAxisID !== 'y1' ? v.toFixed(1) + '%' : v}`; } } } },
    scales: horizontal ? { x: { ...ax, stacked }, y: { grid: { display: false }, stacked } } : { y: { ...ax, stacked }, x: { grid: { display: false }, stacked }, ...(sets.some((s) => s.axis === 'y1') ? { y1: { position: 'right' as const, beginAtZero: true, ticks: { precision: 0 }, grid: { display: false } } } : {}) },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <div className="chart-box" style={{ height }}><Chart type={type} data={data as any} options={options as any} /></div>;
}
