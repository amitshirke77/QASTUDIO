/** Column headings the past-audit importer recognises (compared after `norm`). Shared by the importer and the sample file. */
export const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const FIELDS: Record<string, string[]> = {
  caseId: ['case id', 'case', 'ticket id', 'ticket', 'case no'], agent: ['agent', 'agent name', 'name of agent'], auditor: ['qa', 'name of qa', 'auditor', 'qa name'], tl: ['tl', 'name of tl', 'team leader', 'tl name'],
  auditDate: ['audit date', 'date of audit'], callDate: ['call date', 'email date', 'interaction date', 'date of call'], customer: ['customer', 'customer name', 'client', 'client name'], product: ['product'], lob: ['lob', 'process'], obs: ['observations', 'call observations', 'email observations', 'remarks'], phone: ['phone', 'customer phone', 'customer phone number', 'mobile'], link: ['link', 'call link', 'recording', 'ticket link'],
};
