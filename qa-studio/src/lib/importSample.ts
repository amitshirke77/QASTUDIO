import * as XLSX from 'xlsx';
import { addDays } from './dates';
import type { FormFull } from './data';

type U = { id: string; name: string; role: string; active: boolean; lob: string | null; tlId: string | null };
const dmy = (iso: string) => iso.split('-').reverse().join('/');

/**
 * A sample .xlsx for the past-audit importer: one heading row the importer recognises, two example rows,
 * and an Instructions sheet. Headings are the ones in `FIELDS` plus each parameter's exact name.
 */
export function buildImportSample(form: FormFull, users: U[], customers: string[], products: { lob: string; name: string }[], today: string) {
  const email = form.channel === 'Email';
  const params = form.sections.flatMap((s) => s.params);
  const lob = (form.lobs as string[] | null)?.[0] || 'Tripstacc';
  const agents = users.filter((u) => u.role === 'agent' && u.active && u.lob === lob);
  const ag = [agents[0], agents[1] || agents[0]];
  const qa = users.find((u) => u.role === 'auditor' && u.active) || users.find((u) => u.role === 'qalead');
  const tlOf = (a?: U) => users.find((u) => u.id === a?.tlId)?.name || '';
  const product = products.find((p) => p.lob === lob)?.name || '';
  const cols: [string, string, boolean, string][] = [
    ['caseId', 'Case ID', true, 'Case or ticket number; must be unique'],
    ['agent', 'Agent Name', true, 'Full name of the agent as in Users'],
    ['auditDate', 'Audit Date', true, 'Date of the audit, DD/MM/YYYY'],
    ['callDate', email ? 'Email Date' : 'Call Date', false, 'Date of the call or email, DD/MM/YYYY; blank uses the audit date'],
    ['lob', 'LOB', false, "Tripstacc or Shopstacc; blank uses the agent's LOB, then the default LOB"],
    ['product', 'Product', false, 'Product under the LOB, e.g. Flights, Hotels, EGV, Merchandise'],
    ['customer', 'Customer', false, 'Customer as in Master data, e.g. IDFCFIRST'],
    ['phone', 'Customer Phone', false, 'Optional; only the last 4 digits are kept'],
    ['link', email ? 'Ticket Link' : 'Call Link', false, 'Optional recording or ticket link'],
    ['auditor', 'QA Name', false, 'Auditor who scored it; blank records you as the auditor'],
    ['tl', 'TL Name', false, "Optional; the agent's Team Leader"],
    ['obs', 'Observations', false, 'Optional observations'],
  ];
  const firstN = params.findIndex((p) => !p.fatal && (p.options as string[]).includes('N'));
  const rate = (i: number, row: number) => { const o = params[i].options as string[]; if (row === 1 && i === firstN) return 'N'; if (row === 1 && i === params.length - 1 && o.includes('NA')) return 'NA'; return o.includes('Y') ? 'Y' : o[0]; };
  const row = (n: number, a: U | undefined, d: string) => {
    const v: Record<string, string> = { caseId: (email ? 'TKT' : 'CC') + (70100 + n), agent: a?.name || '', auditDate: dmy(addDays(d, 1)), callDate: dmy(d), lob, product, customer: customers[0] || '', phone: '98XXXX' + (4321 + n), link: (email ? 'https://crm.example/ticket/' : 'https://dialer.example/rec/') + (70100 + n), auditor: qa?.name || '', tl: tlOf(a), obs: n ? 'Did not confirm the booking details before closing.' : 'Followed the opening and closing script well.' };
    return [...cols.map((c) => v[c[0]]), ...params.map((_, i) => rate(i, n))];
  };
  const head = [...cols.map((c) => c[1]), ...params.map((p) => p.name)];
  const aoa = [head, row(0, ag[0], addDays(today, -2)), row(1, ag[1], addDays(today, -1))];
  const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = head.map((h) => ({ wch: Math.min(40, Math.max(10, h.length + 2)) }));
  const ins = [['Column', 'Required', 'What to enter'], ...cols.map((c) => [c[1], c[2] ? 'Yes' : 'No', c[3]]),
    ...params.map((p) => [p.name, 'Yes', `${(p.options as string[]).join(', ')}${p.fatal ? '. Fatal: any N makes the Actual score 0' : ''}`]), [],
    ['Notes', '', `Built for "${form.name} v${form.version}" (${form.channel}). Keep the headings in row 1 and one audit per row. Delete the two example rows before you import. Scores are recalculated by the tool.`]];
  const wi = XLSX.utils.aoa_to_sheet(ins); wi['!cols'] = [{ wch: 44 }, { wch: 10 }, { wch: 80 }];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, email ? 'Email audits' : 'Call audits'); XLSX.utils.book_append_sheet(wb, wi, 'Instructions');
  const name = `QA-Studio-import-sample-${form.name.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')}.xlsx`;
  return { name, buf: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer, head, params };
}
