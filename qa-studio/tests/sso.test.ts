import { describe, it, expect } from 'vitest';
import { matchOrg, accountFits } from '../src/lib/sso';
import { scopeFor } from '../src/lib/scope';

const STAFF = { domains: ['zipstacc.com'], tenantIds: ['11111111-1111-1111-1111-111111111111'] };
const CL = [
  { id: 'custcap', companyId: 'expenova', name: 'CUSTCAP', active: true, ssoDomains: ['customer-capital.com'], ssoTenantIds: ['22222222-2222-2222-2222-222222222222'], autoProvision: false },
  { id: 'uppercase', companyId: 'peopleocity', name: 'UPPERCASE', active: true, ssoDomains: ['uppercase.example'], ssoTenantIds: [], autoProvision: true },
];

describe('Microsoft 365 sign-in: which organization', () => {
  it('zipstacc accounts are staff', () => {
    const m = matchOrg({ upn: 'Amit.Shirke@zipstacc.com', tid: STAFF.tenantIds[0] }, STAFF, CL, false);
    expect(m).toEqual({ ok: true, org: { kind: 'staff' }, email: 'amit.shirke@zipstacc.com' });
  });
  it('customer-capital accounts belong to CUSTCAP only', () => {
    const m = matchOrg({ upn: 'ravi@customer-capital.com' }, STAFF, CL, false);
    expect(m.ok && m.org.kind === 'client' && m.org.clientId).toBe('custcap');
  });
  it('B2B guest: the #EXT# UPN is ignored and the real email decides', () => {
    const m = matchOrg({ upn: 'ravi_customer-capital.com#EXT#@zipstacc.onmicrosoft.com', email: 'ravi@customer-capital.com' }, STAFF, CL, false);
    expect(m.ok && m.org.kind === 'client' && m.org.clientId).toBe('custcap');
  });
  it('unknown domains are refused', () => {
    expect(matchOrg({ upn: 'someone@gmail.com' }, STAFF, CL, false)).toEqual({ ok: false, error: 'Domain' });
    expect(matchOrg({}, STAFF, CL, false)).toEqual({ ok: false, error: 'NoEmail' });
  });
  it('multi-tenant mode requires the tenant ID to match', () => {
    expect(matchOrg({ upn: 'ravi@customer-capital.com', tid: '22222222-2222-2222-2222-222222222222' }, STAFF, CL, true).ok).toBe(true);
    expect(matchOrg({ upn: 'ravi@customer-capital.com', tid: '99999999-9999-9999-9999-999999999999' }, STAFF, CL, true)).toEqual({ ok: false, error: 'Tenant' });
    expect(matchOrg({ upn: 'x@uppercase.example', tid: '22222222-2222-2222-2222-222222222222' }, STAFF, CL, true)).toEqual({ ok: false, error: 'Tenant' }); // UPPERCASE has no tenant listed
    expect(matchOrg({ upn: 'amit@zipstacc.com', tid: '22222222-2222-2222-2222-222222222222' }, STAFF, CL, true)).toEqual({ ok: false, error: 'Tenant' });
  });
  it('an inactive client cannot sign in', () => {
    expect(matchOrg({ upn: 'ravi@customer-capital.com' }, STAFF, [{ ...CL[0], active: false }], false)).toEqual({ ok: false, error: 'Domain' });
  });
  it('an existing login must belong to the same organization', () => {
    const cc = { kind: 'client' as const, clientId: 'custcap', companyId: 'expenova', autoProvision: false };
    expect(accountFits({ role: 'client', clientId: 'custcap' }, cc)).toBe(true);
    expect(accountFits({ role: 'client', clientId: 'uppercase' }, cc)).toBe(false);
    expect(accountFits({ role: 'admin', clientId: null }, cc)).toBe(false);
    expect(accountFits({ role: 'client', clientId: 'custcap' }, { kind: 'staff' })).toBe(false);
  });
});

describe('data scope', () => {
  const clients = [{ id: 'custcap', companyId: 'expenova' }, { id: 'uppercase', companyId: 'peopleocity' }, { id: 'other', companyId: 'expenova' }];
  it('a client stakeholder sees only their client', () => {
    expect(scopeFor({ role: 'client', clientId: 'custcap' }, clients)).toEqual(['custcap']);
    expect(scopeFor({ role: 'client', clientId: 'uppercase' }, clients)).toEqual(['uppercase']);
    expect(scopeFor({ role: 'client', clientId: null }, clients)).toEqual([]);
  });
  it('company staff see their company clients; group-wide staff see all', () => {
    expect(scopeFor({ role: 'qalead', companyId: 'expenova' }, clients)).toEqual(['custcap', 'other']);
    expect(scopeFor({ role: 'qalead', companyId: 'peopleocity' }, clients)).toEqual(['uppercase']);
    expect(scopeFor({ role: 'admin', companyId: null }, clients)).toBeNull();
  });
});

import { matchGoogle } from '../src/lib/sso';
describe('Google sign-in', () => {
  it('accepts a verified Google Workspace account on a staff or client domain', () => {
    expect(matchGoogle({ email: 'amit@zipstacc.com', email_verified: true, hd: 'zipstacc.com' }, STAFF, CL)).toMatchObject({ ok: true, org: { kind: 'staff' } });
    const m = matchGoogle({ email: 'x@uppercase.example', email_verified: true, hd: 'uppercase.example' }, STAFF, CL);
    expect(m.ok && m.org.kind === 'client' && m.org.clientId).toBe('uppercase');
  });
  it('refuses personal Google accounts that use a work email, and unverified emails', () => {
    expect(matchGoogle({ email: 'amit@zipstacc.com', email_verified: true }, STAFF, CL)).toEqual({ ok: false, error: 'GoogleWorkspace' });
    expect(matchGoogle({ email: 'amit@zipstacc.com', email_verified: false, hd: 'zipstacc.com' }, STAFF, CL)).toEqual({ ok: false, error: 'Unverified' });
    expect(matchGoogle({ email: 'someone@gmail.com', email_verified: true, hd: 'gmail.com' }, STAFF, CL)).toEqual({ ok: false, error: 'Domain' });
  });
});
