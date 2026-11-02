/** Small company logo on a white chip (readable in light and dark mode). Unknown companies fall back to their name. */
const LOGOS: Record<string, { src: string; ratio: number; alt: string }> = {
  expenova: { src: '/logos/expenova.png', ratio: 161 / 96, alt: 'Expenova BPO Solutions' },
  peopleocity: { src: '/logos/peopleocity.png', ratio: 495 / 96, alt: 'PeopleOCity' },
};
export function CompanyLogo({ id, name, h = 18, title }: { id?: string | null; name?: string; h?: number; title?: string }) {
  const l = id ? LOGOS[id] : undefined;
  if (!l) return name ? <span className="co-logo co-logo-txt" style={{ height: h + 6 }}>{name}</span> : null;
  // eslint-disable-next-line @next/next/no-img-element
  return <span className="co-logo" title={title || l.alt}><img src={l.src} alt={l.alt} width={Math.round(h * l.ratio)} height={h} /></span>;
}
export const hasLogo = (id?: string | null) => !!(id && LOGOS[id]);
