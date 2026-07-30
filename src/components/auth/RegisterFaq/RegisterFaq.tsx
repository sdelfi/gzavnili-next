import { getTranslations } from 'next-intl/server';
import { FaqAccordion } from '@/components/FaqAccordion';
import { routes } from '@/lib/routes';

// The register page's right-column FAQ — legacy `register.html`'s `.col-6.faq` section
// (locale-dependent content, 5 Q&A items transcribed off the legacy source, not invented).
// Reuses the homepage's `FaqAccordion` for the actual expand/collapse widget instead of
// rebuilding it — its CSS was already properly extracted from `style.css`'s `.faq-item`
// rules into its own self-contained module, no `.faq` ancestor class required. Only the
// surrounding "Not sure yet?"/"See More" copy is register-specific, and those use classes
// (`.faq-notsure`, `.ralign`) that are already global in style.css.
export async function RegisterFaq() {
  const t = await getTranslations('Register');
  const faqItems = t.raw('faqItems') as { question: string; answer: string }[];

  return (
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
      <FaqAccordion items={faqItems} />

      <div className="ralign">
        <p>
          <a href={routes.page('faqregistration')}>{t('seeMore')}</a>
        </p>
      </div>
    </section>
  );
}
