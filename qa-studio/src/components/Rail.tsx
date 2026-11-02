'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavItem } from '@/lib/nav';
export default function Rail({ nav, badges }: { nav: [string, NavItem[]][]; badges: Record<string, number> }) {
  const p = usePathname();
  const all = nav.flatMap((g) => g[1].map((i) => i.href));
  const best = all.filter((h) => p === h || p.startsWith(h + '/')).sort((a, b) => b.length - a.length)[0];
  return (
    <nav className="rail" aria-label="Modules">
      {nav.map(([g, items]) => (
        <div key={g} style={{ display: 'contents' }}>
          <div className="grp">{g}</div>
          {items.map((i) => (
            <Link key={i.href} href={i.href} className={best === i.href ? 'on' : ''}>
              {i.label}{i.badge && badges[i.badge] ? <span className="badge">{badges[i.badge]}</span> : null}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
