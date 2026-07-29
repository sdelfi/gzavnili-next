import { getTranslations } from 'next-intl/server';
import cn from 'classnames';
import { Link } from '@/i18n/navigation';
import { FaqAccordion } from '@/components/FaqAccordion';
import { routes } from '@/lib/routes';
import s from './Faq.module.css';

export async function Faq() {
  const t = await getTranslations('Faq');
  const items = t.raw('items') as { question: string; answer: string }[];

  return (
    <section className={cn('col', 'col-6', s.faq)}>
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
