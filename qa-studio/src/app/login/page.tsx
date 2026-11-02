import { redirect } from 'next/navigation';
import { currentUser, ssoEnabled, googleEnabled } from '@/lib/auth';
import { homeFor } from '@/lib/rbac';
import LoginForm from './LoginForm';
export const dynamic = 'force-dynamic';
const ERR: Record<string, string> = { Domain: 'That email domain is not set up for QA Studio. Staff use their zipstacc account; client stakeholders use the domain set up for their client.', Tenant: 'Your organization’s Microsoft 365 tenant is not set up for QA Studio yet. Ask the admin to add it.', Mismatch: 'This Microsoft 365 account does not match the QA Studio login with that email. Ask the admin to check it.', NoAccount: 'You do not have a QA Studio login yet. Ask your Expenova or PeopleOCity contact to add you.', NoRole: 'Your Microsoft 365 account is not in a QA Studio group. Ask the admin to add you.', Disabled: 'Your account is disabled or single sign-in is off for it.', NoEmail: 'The sign-in did not return an email address.', Unverified: 'Your Google account email is not verified.', GoogleWorkspace: 'Use your company Google Workspace account. Personal Google accounts cannot sign in, even with a work email address.' };
export default async function Login({ searchParams }: { searchParams: { error?: string } }) {
  const u = await currentUser(); if (u) redirect(homeFor(u.role));
  return <LoginForm sso={ssoEnabled} google={googleEnabled} error={searchParams.error ? ERR[searchParams.error] || 'Sign-in failed.' : ''} />;
}
