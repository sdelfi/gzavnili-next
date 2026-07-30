import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/LoginForm';

// Same URL/title as the legacy `views/authenticate/login.html`
// (`HTTPRequest.getArg('page').setMetaTitle('Sign in - #application.applicationname#')`) —
// keeping the path and `<title>` identical matters for SEO (existing search-engine/backlink
// equity to this URL), even though the markup itself isn't a pixel-for-pixel port.
export const metadata: Metadata = {
  title: 'Sign in - Gzavnili',
  description: 'Sign in to your Gzavnili account to track parcels, manage shipments, and view your statement.',
};

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ret?: string; registered?: string; reset?: string }>;
}) {
  const { locale } = await params;
  const { ret, registered, reset } = await searchParams;

  return (
    <section className="accountreg">
      <div className="container loginpage">
        <h1>Sign in</h1>
        {registered && <p>Account created — please log in.</p>}
        {reset && <p>Your password has been reset — please log in.</p>}
        <LoginForm locale={locale} ret={ret} />
      </div>
    </section>
  );
}
