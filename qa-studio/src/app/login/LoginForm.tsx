'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { CompanyLogo } from '@/components/CompanyLogo';
export default function LoginForm({ sso, google, error }: { sso: boolean; google: boolean; error: string }) {
  const [u, setU] = useState(''), [p, setP] = useState(''), [err, setErr] = useState(error), [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true);
    const r = await signIn('credentials', { username: u, password: p, redirect: false });
    setBusy(false);
    if (r?.ok && !r.error) window.location.href = '/'; else setErr(r?.error && r.error !== 'CredentialsSignin' ? r.error : 'Username or password is incorrect.');
  };
  return (
    <div className="login"><section className="login-art"><div className="brand" style={{ color: 'inherit' }}><span className="brand-mark">QA</span>QA Studio</div><div><h1>Every call and email, scored the same way.</h1><p>Audits, feedback, disputes, learning and calibration for every client program across Expenova and PeopleOCity. Each client sees only its own data.</p></div><span className="co-logos" aria-label="Expenova BPO Solutions and PeopleOCity"><CompanyLogo id="expenova" h={26} /><CompanyLogo id="peopleocity" h={26} /></span></section>
    <section className="login-panel"><div className="login-box">
      <div><h2>Sign in</h2><p className="muted" style={{ margin: '4px 0 0' }}>Use your Microsoft 365 or Google Workspace work account, or your username.</p></div>
      {(sso || google) && <>{sso && <button className="btn ms-btn" onClick={() => signIn('azure-ad', { callbackUrl: '/' })} style={{ justifyContent: 'center', padding: 10 }}><span className="ms-logo" aria-hidden="true"><i style={{ background: '#f25022' }} /><i style={{ background: '#7fba00' }} /><i style={{ background: '#00a4ef' }} /><i style={{ background: '#ffb900' }} /></span>Sign in with Microsoft</button>}{google && <button className="btn ms-btn" onClick={() => signIn('google', { callbackUrl: '/' })} style={{ justifyContent: 'center', padding: 10 }}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>Sign in with Google</button>}<div className="or"><span>or use a username</span></div></>}
      <form id="loginForm" className="stack" style={{ gap: 10 }} onSubmit={submit}>
        <div className="field"><label htmlFor="lu">Username</label><input type="text" id="lu" autoComplete="username" value={u} onChange={(e) => setU(e.target.value)} required /></div>
        <div className="field"><label htmlFor="lp">Password</label><input type="password" id="lp" autoComplete="current-password" value={p} onChange={(e) => setP(e.target.value)} required /></div>
        <div className="err" id="lerr" role="alert">{err}</div>
        <button className="btn primary" type="submit" disabled={busy} style={{ justifyContent: 'center', padding: 10 }}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>

    </div></section></div>
  );
}
