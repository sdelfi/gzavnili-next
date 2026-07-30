import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { FaqAccordion } from '@/components/FaqAccordion';
import { routes } from '@/lib/routes';

// `.faq h3`/`.faq .ralign` styling lives in globals.css — shared with RegisterFaq
// (/authenticate/register), see that global rule's comment.
export async function Faq() {
  const t = await getTranslations('Faq');
  const items = t.raw('items') as { question: string; answer: string }[];

  return (
    <section className="col col-6 faq">
      <h3>{t('heading')}</h3>

      <FaqAccordion items={items} />

      <div className="ralign">
        <p>
          <Link href={routes.page('faq')}>{t('seeAllAnswers')}</Link>
        </p>
      </div>
    </section>
  );
}
