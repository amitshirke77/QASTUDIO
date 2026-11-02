import { db, schema as t } from '@/db';
import { getForms } from './data';
export async function sessionAgreement(sid: string, formId: string) {
  const forms = await getForms([formId]); const f = forms[0]; if (!f) return { params: [], pack: [] };
  const params = f.sections.flatMap((s) => s.params.map((p) => ({ id: p.id, name: p.name, section: s.name })));
  const [items, scores, agreed] = await Promise.all([db.select().from(t.calibItems), db.select().from(t.calibScores), db.select().from(t.calibAgreed)]);
  const pack = items.filter((i) => i.sessionId === sid).map((i) => ({ params, scores: scores.filter((s) => s.itemId === i.id), agreed: Object.fromEntries(agreed.filter((a) => a.itemId === i.id).map((a) => [a.paramId, a.value])) }));
  return { params, pack };
}
