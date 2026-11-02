'use client';
import { useState } from 'react';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
export default function UserMenu({ name, role, initials }: { name: string; role: string; initials: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rel">
      <button className="usermenu" onClick={() => setOpen(!open)} aria-expanded={open}><span className="avatar">{initials}</span><span className="who"><b>{name}</b><span>{role}</span></span></button>
      {open && <div className="dd" style={{ right: 0 }}><Link className="dd-item" href="/help" onClick={() => setOpen(false)}>Help</Link><button className="dd-item" onClick={() => signOut({ callbackUrl: '/login' })}>Sign out</button></div>}
    </div>
  );
}
