import type { Metadata } from 'next';
import { AuthProvider } from '@/components/admin/AuthProvider';
import 'normalize.css';
import './bema.css';

// Independent root layout (own <html>/<body>) — bema is a separate app from the public
// marketing site's `[locale]` tree (own auth realm, own CSR-only rendering strategy per
// docs/migrations/03-target-architecture.md §1/§3), so it doesn't share that layout's
// fonts/CSS/Header/Footer. Next.js allows multiple independent root layouts as long as
// neither is nested inside the other — `bema/` and `[locale]/` are disjoint sibling trees
// under `src/app/`, so each defining its own `<html>`/`<body>` is the supported pattern,
// not a workaround.
export const metadata: Metadata = {
  title: 'Gzavnili — bema',
};

export default function BemaRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
