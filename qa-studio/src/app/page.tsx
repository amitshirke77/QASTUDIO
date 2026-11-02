import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { homeFor } from '@/lib/rbac';
export default async function Home() { const u = await currentUser(); redirect(u ? homeFor(u.role) : '/login'); }
