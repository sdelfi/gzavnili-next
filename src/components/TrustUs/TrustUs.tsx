import Image from 'next/image';
import cn from 'classnames';
import { getTranslations } from 'next-intl/server';
import s from './TrustUs.module.css';

export async function TrustUs() {
  const t = await getTranslations('TrustUs');
  const paragraphs = t.raw('paragraphs') as string[];

  return (
    <section className={s.trustus}>
      <div className="container">
        <div className={s.trustusL}>
          <Image src="/img/trustus.jpg" alt="" width={284} height={550} />
        </div>

        <div className={s.trustusR}>
          <h2 dangerouslySetInnerHTML={{ __html: t.raw('heading') }} />
          <div className="redline"></div>

          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}

          <div className={s.advantages}>
            <div className={cn(s.advItem, s.item1)}>
              <span>{t('years')}</span> {t('yearsLabel')}
            </div>
            <div className={cn(s.advItem, s.item2)}>
              <span>{t('packages')}</span> {t('packagesLabel')}
            </div>
            <div className={cn(s.advItem, s.item3)}>
              <span>{t('customers')}</span> {t('customersLabel')}
            </div>
          </div>

          <p>{t('closingParagraph')}</p>
        </div>
      </div>
    </section>
  );
}
