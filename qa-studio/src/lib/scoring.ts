/**
 * Scoring rules (from the CUSTCAP Quality Sheet, with the sheet's formula bug fixed):
 *  - Overall = weight of parameters rated Y or NA ÷ total weight × 100 (NA counts as met).
 *  - Actual  = 0 when any fatal parameter is rated N, otherwise equal to Overall.
 *  - Every parameter counts, including CRM tagging (the sheet omitted column AU, capping at 95).
 */
export type Rating = 'Y' | 'N' | 'NA';
export type ScoreParam = { id: string; weight: number; fatal: boolean };
export type ScoreForm = { sections: { id: string; name: string; params: ScoreParam[] }[] };
export type SectionScore = { id: string; name: string; total: number; earned: number; answered: number; count: number; fatal: boolean; score: number | null };
export type Score = { overall: number; actual: number; running: number | null; fatal: boolean; answered: number; count: number; total: number; earned: number; sections: SectionScore[] };

export function scoreOf(form: ScoreForm, ans: Record<string, Rating | string | undefined>): Score {
  let total = 0, earned = 0, answeredW = 0, answered = 0, count = 0, fatal = false;
  const sections: SectionScore[] = [];
  for (const s of form.sections) {
    let st = 0, se = 0, sw = 0, sa = 0, sf = false;
    for (const p of s.params) {
      const w = +p.weight || 0; st += w; count++;
      const v = ans[p.id];
      if (v) { sa++; answered++; sw += w; answeredW += w; }
      if (v === 'Y' || v === 'NA') se += w;
      if (v === 'N' && p.fatal) sf = true;
    }
    total += st; earned += se; if (sf) fatal = true;
    sections.push({ id: s.id, name: s.name, total: st, earned: se, answered: sa, count: s.params.length, fatal: sf, score: sw ? (se / sw) * 100 : null });
  }
  const overall = total ? (earned / total) * 100 : 0;
  const running = answeredW ? (earned / answeredW) * 100 : null;
  return { overall, actual: fatal ? 0 : overall, running, fatal, answered, count, total, earned, sections };
}
