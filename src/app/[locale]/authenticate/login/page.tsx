import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { QuestionPanel } from '@/components/auth/QuestionPanel';
import { Greeting } from '@/components/auth/Greeting';
import { LoginForm } from '@/components/auth/LoginForm';
import type { GreetingCopy } from '@/components/auth/Greeting';

// Same URL/title as the legacy `views/authenticate/login.html` — keeping the path and
// `<title>` identical matters for SEO (existing search-engine/backlink equity to this URL).
// See docs/decisions/0012-customer-auth.md.
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
  const t = await getTranslations('Authenticate');
  const greetingCopy = t.raw('greeting') as GreetingCopy;

  return (
    <AuthLayout title={t('signIn')} homeLabel={t('breadcrumbHome')} aside={<QuestionPanel />}>
      <Greeting copy={greetingCopy} />
      {registered && <p>Account created — please log in.</p>}
      {reset && <p>Your password has been reset — please log in.</p>}
      <LoginForm locale={locale} ret={ret} />
    </AuthLayout>
  );
}
