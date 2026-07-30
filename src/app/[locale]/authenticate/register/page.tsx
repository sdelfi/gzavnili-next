import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { routes } from '@/lib/routes';

// Matches legacy `views/authenticate/register.html`'s meta title exactly (see the login
// page's comment on why the URL/title stay identical for SEO). Layout mirrors that file
// 1:1: `.container > h1 + .row > (.col-6.col-regform form, .col-6.faq)` — the right-column
// FAQ content (locale-dependent) is real, transcribed off the legacy source, not invented.
export const metadata: Metadata = {
  title: 'Register - Gzavnili',
  description: 'Create a free Gzavnili account to ship parcels, cargo, and courier deliveries.',
};

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations('Register');
  const faqItems = t.raw('faqItems') as { question: string; answer: string }[];

  return (
    <section className="accountreg">
      <div className="container">
        <h1>{t('heading')}</h1>

        <div className="row">
          <div className="col col-6 col-regform">
            <RegisterForm locale={locale} />
          </div>

          <section className="col col-6 col-sm-12 faq">
            <div className="faq-notsure">
              <h3>{t('notSureYetTitle')}</h3>
              <p>
                {t.rich('notSureYetText', {
                  link: (chunks) => <a href={routes.testAccountLogin()}>{chunks}</a>,
                })}
              </p>
            </div>

            <h3>{t('faqHeading')}</h3>

            <div className="faq-list">
              {faqItems.map((item) => (
                <div className="faq-item" key={item.question}>
                  <div className="question">{item.question}</div>
                  <div className="answer">{item.answer}</div>
                </div>
              ))}
            </div>

            <div className="ralign">
              <p>
                <a href={routes.page('faqregistration')}>{t('seeMore')}</a>
              </p>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
