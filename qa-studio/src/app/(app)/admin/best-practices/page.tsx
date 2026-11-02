import { requireUser } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { getSetting } from '@/lib/data';
import { PageHead } from '@/components/ui';
import { BestPractices } from '../Settings';
export default async function B() { const u = await requireUser(); if (!['admin', 'qalead'].includes(u.role)) return null; const v = await getSetting<Record<string, { status: string; value?: number }>>('bp', {});
  return <><PageHead title="Best practices" sub="Recommended rules. Each one takes effect only after the Admin approves it." /><BestPractices v={v} canEdit={can(u.role, 'bp.approve')} /></>; }
