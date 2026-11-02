import './globals.css';
import './apple.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'QA Studio', description: 'Call and email quality program for Expenova and PeopleOCity clients' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
