import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { RegisterLayout } from '@/components/auth/RegisterLayout';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { RegisterFaq } from '@/components/auth/RegisterFaq';

// Same URL/title as legacy `views/authenticate/register.html` (SEO parity, see the login
// page's comment on why). See docs/decisions/0012-customer-auth.md.
export const metadata: Metadata = {
  title: 'Register - Gzavnili',
  description: 'Create a free Gzavnili account to ship parcels, cargo, and courier deliveries.',
};

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations('Register');

  return <RegisterLayout title={t('heading')} form={<RegisterForm locale={locale} />} faq={<RegisterFaq />} />;
}
