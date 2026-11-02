'use client';
import { useRouter, useSearchParams } from 'next/navigation';
export function AuditorPicker({ auditors, value }: { auditors: [string, string][]; value: string }) {
  const r = useRouter(), sp = useSearchParams();
  return <select aria-label="Auditor" value={value} onChange={(e) => { const n = new URLSearchParams(sp.toString()); n.set('auditor', e.target.value); r.push('/plan?' + n); }}>{auditors.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>;
}
