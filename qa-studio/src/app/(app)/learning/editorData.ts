import { activeForms, getUsers } from '@/lib/data';
import { visibleUsers } from '@/lib/scope';
import type { SessionUser } from '@/lib/rbac';
export async function editorData(u: SessionUser) {
  const users = await visibleUsers(u, await getUsers()); const forms = await activeForms();
  return {
    agents: users.filter((x) => x.role === 'agent' && x.active).map((x) => ({ id: x.id, name: x.name, lob: x.lob || '' })),
    tls: users.filter((x) => x.role === 'tl').map((x) => ({ id: x.id, name: x.name })),
    forms: forms.map((f) => ({ id: f.id, name: f.name, sections: f.sections.map((s) => ({ name: s.name, params: s.params.map((p) => ({ code: p.code, name: p.name })) })) })),
  };
}
