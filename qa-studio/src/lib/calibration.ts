/** Most common rating and its share (agreement %). */
export function mode(vals: string[]) {
  const c = new Map<string, number>(); vals.forEach((v) => c.set(v, (c.get(v) || 0) + 1));
  let best = '', n = 0; c.forEach((k, v) => { if (k > n) { n = k; best = v; } });
  return { mode: best, share: vals.length ? (n / vals.length) * 100 : null };
}
export type CalScore = { userId: string; itemId: string; answers: Record<string, string>; overall: number; actual: number };
export type CalParam = { id: string; name: string; section: string };

export function itemResult(params: CalParam[], scores: CalScore[], agreed: Record<string, string>) {
  const rows = params.map((p) => {
    const vals = scores.map((s) => s.answers[p.id]).filter(Boolean);
    const m = mode(vals);
    return { p, vals: scores.map((s) => s.answers[p.id] || ''), mode: m.mode, agreement: m.share, agreed: agreed[p.id] || '', ref: agreed[p.id] || m.mode };
  });
  const ov = scores.map((s) => s.overall); const mean = ov.length ? ov.reduce((a, b) => a + b, 0) / ov.length : null;
  return { rows, mean, deviations: scores.map((s) => ({ userId: s.userId, overall: s.overall, actual: s.actual, dev: mean == null ? null : s.overall - mean })) };
}

/** Share of an auditor's ratings that match the agreed (or most common) rating across a session. */
export function auditorAgreement(items: { params: CalParam[]; scores: CalScore[]; agreed: Record<string, string> }[], userId: string) {
  let m = 0, n = 0;
  for (const it of items) {
    const mine = it.scores.find((s) => s.userId === userId); if (!mine) continue;
    const r = itemResult(it.params, it.scores, it.agreed);
    for (const x of r.rows) { const v = mine.answers[x.p.id]; if (!v || !x.ref) continue; n++; if (v === x.ref) m++; }
  }
  return n ? (m / n) * 100 : null;
}
