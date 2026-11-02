import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { buildImportSample } from '../src/lib/importSample';
import { FIELDS, norm } from '../src/lib/importCols';

const p = (id: string, name: string, fatal = false, options = ['Y', 'N', 'NA']) => ({ id, name, code: id, fatal, options, weight: 2, description: '', guideY: '', guideN: '', guideNA: '', ord: 0, formId: 'f1', sectionId: 's1' });
const form = { id: 'f1', name: 'Call Evaluation', version: 1, channel: 'Call', lobs: ['Tripstacc'], status: 'Active', sections: [{ id: 's1', name: 'Opening', params: [p('p1', 'Greeting and introduction'), p('p2', 'Hold etiquette'), p('p3', 'Data security', true, ['Y', 'N'])] }] } as never;
const users = [{ id: 'a1', name: 'Ravi Kumar', role: 'agent', active: true, lob: 'Tripstacc', tlId: 't1' }, { id: 't1', name: 'Neha TL', role: 'tl', active: true, lob: null, tlId: null }, { id: 'q1', name: 'Sagar QA', role: 'auditor', active: true, lob: null, tlId: null }];

describe('import sample file', () => {
  const s = buildImportSample(form, users, ['IDFCFIRST'], [{ lob: 'Tripstacc', name: 'Flights' }], '2026-10-25');
  const wb = XLSX.read(s.buf, { type: 'buffer' });
  const grid = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  it('has a data sheet and an Instructions sheet', () => { expect(wb.SheetNames).toEqual(['Call audits', 'Instructions']); expect(s.name).toBe('QA-Studio-import-sample-Call-Evaluation.xlsx'); });
  it('uses headings the importer recognises for every field and parameter', () => {
    const head = grid[0].map(norm);
    for (const k of Object.keys(FIELDS)) expect(head.some((h) => FIELDS[k].includes(h)), k).toBe(true);
    for (const x of ['Greeting and introduction', 'Hold etiquette', 'Data security']) expect(head).toContain(norm(x));
  });
  it('has two example rows with valid ratings and day/month/year dates', () => {
    expect(grid.length).toBe(3);
    const h = grid[0]; const r = grid[2];
    expect(r[h.indexOf('Audit Date')]).toBe('25/10/2026');
    expect(r[h.indexOf('Greeting and introduction')]).toBe('N');
    expect(r[h.indexOf('Data security')]).toBe('Y'); // fatal, NA not allowed
    expect(r[h.indexOf('TL Name')]).toBe('Neha TL');
  });
});
