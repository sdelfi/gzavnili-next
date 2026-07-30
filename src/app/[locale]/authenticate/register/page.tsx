import type { Metadata } from 'next';
import { RegisterForm } from '@/components/auth/RegisterForm';

// Matches legacy `views/authenticate/register.html`'s meta title exactly (see the login
// page's comment on why the URL/title stay identical for SEO).
export const metadata: Metadata = {
  title: 'Register - Gzavnili',
  description: 'Create a free Gzavnili account to ship parcels, cargo, and courier deliveries.',
};

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return (
    <section className="accountreg">
      <div className="container">
        <h1>Register</h1>
        <RegisterForm locale={locale} />
      </div>
    </section>
  );
}
