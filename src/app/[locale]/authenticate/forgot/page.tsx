import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';

// Matches legacy `views/authenticate/forgotlogin.html`'s meta title exactly. Note: legacy's
// URL has a trailing slash (`/authenticate/forgot/`); this app's default (no
// `trailingSlash: true` in next.config) redirects that to the slash-less form, a standard
// 308 rather than a 404 — acceptable per the login page's SEO note, since it's still a
// redirect to the same canonical page, not a broken link.
export const metadata: Metadata = {
  title: 'Forgot Username or Password - Gzavnili',
  description: 'Reset your Gzavnili account password by email.',
};

export default async function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return (
    <section className="accountreg">
      <div className="container loginpage">
        <h1>Forgot Username or Password – Account Restore</h1>
        <ForgotPasswordForm locale={locale} />
      </div>
    </section>
  );
}
