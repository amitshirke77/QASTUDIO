import { describe, it, expect } from 'vitest';
import { adherence, periodWindow } from '../src/lib/adherence';
import { DEFAULT_PLAN } from '../src/lib/targets';

const months = ['2026-07', '2026-08', '2026-09'];
const L = (customer: string, product: string, channel: string, vol: number) => ({
  line: { id: customer + product + channel, customer, lob: 'Tripstacc', product, channel, projected: null, goLive: null, isNew: false, rate: null, override: null, active: true },
  vols: months.map((m) => ({ customer, lob: 'Tripstacc', product, channel, month: m, count: vol })),
});
const a = L('IDFCFIRST', 'Flights', 'Call', 2400), b = L('AMEX', 'Hotels', 'Call', 800), c = L('IDFCFIRST', 'Flights', 'Email', 400);
const base = {
  auditorId: 'u3', P: DEFAULT_PLAN, today: '2026-10-21',
  cfgs: [{ userId: 'u3', period: 'Monthly', share: 1, lobs: ['Tripstacc'], overrideCalls: null, overrideEmails: null }],
  lines: [a.line, b.line, c.line], vols: [...a.vols, ...b.vols, ...c.vols],
  agents: [{ id: 'a1', name: 'Bijal', lob: 'Tripstacc', active: true }, { id: 'a2', name: 'Aatish', lob: 'Tripstacc', active: true }, { id: 'a6', name: 'Imran', lob: 'Shopstacc', active: true }],
};
const audit = (agentId: string, customer: string, product: string, channel: string, auditDate = '2026-10-05') => ({ agentId, customer, lob: 'Tripstacc', product, channel, auditDate });

describe('plan adherence', () => {
  it('period window counts Monday–Saturday working days', () => {
    const w = periodWindow('Weekly', '2026-10-21'); // Wednesday
    expect(w.from).toBe('2026-10-19'); expect(w.to).toBe('2026-10-25'); expect(w.workDays).toBe(6); expect(w.workDaysGone).toBe(3);
    expect(periodWindow('Monthly', '2026-10-21').workDays).toBe(27);
  });
  it('builds the plan from the volume lines and the composition', () => {
    const r = adherence({ ...base, audits: [] })!;
    expect(Math.round(r.planTotal)).toBe(24 + 8 + 6); // 1% of 2,400 and 800 calls; 1.5% of 400 emails
    expect(r.byChannel.find((x) => x.key === 'Call')!.plan).toBeCloseTo(32);
    expect(r.byClient[0].key).toBe('IDFCFIRST');
    expect(r.status).toBe('Behind pace');
  });
  it('splits the plan across agents in the LOB and ignores other LOBs', () => {
    const r = adherence({ ...base, audits: [] })!;
    expect(r.agentRows.map((x) => x.id).sort()).toEqual(['a1', 'a2']);
    expect(r.agentRows[0].planCalls).toBeCloseTo(16); expect(r.agentRows[0].planEmails).toBeCloseTo(3);
  });
  it('suggests the lines and agents furthest behind, spreading across agents', () => {
    const audits = Array.from({ length: 10 }, () => audit('a1', 'IDFCFIRST', 'Flights', 'Call'));
    const r = adherence({ ...base, audits })!;
    expect(r.suggestions.length).toBeGreaterThan(0);
    expect(r.suggestions[0].agentId).toBe('a2'); // a1 already has 10 calls
    expect(new Set(r.suggestions.map((s) => s.customer + s.channel)).size).toBe(r.suggestions.length);
    expect(r.mixMatch).not.toBeNull();
  });
  it('applies overrides by rescaling the mix, and returns null without a target config', () => {
    const r = adherence({ ...base, cfgs: [{ ...base.cfgs[0], overrideCalls: 16 }], audits: [] })!;
    expect(r.byChannel.find((x) => x.key === 'Call')!.plan).toBeCloseTo(16);
    expect(r.byClient.find((x) => x.key === 'AMEX')!.plan).toBeCloseTo(4);
    expect(adherence({ ...base, auditorId: 'nobody', audits: [] })).toBeNull();
  });
});
