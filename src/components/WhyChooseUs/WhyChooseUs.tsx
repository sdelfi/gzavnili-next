import cn from 'classnames';
import { getTranslations } from 'next-intl/server';
import { Calculator } from '@/components/Calculator';
import { Icon, type IconName } from '@/components/ui/Icon';
import s from './WhyChooseUs.module.css';
// Icons are positional (not part of the translated content) — index-matched to the
// `WhyChooseUs.items` array in messages/*.json.
const ICONS: IconName[] = ['whyus-1', 'whyus-7', 'whyus-2', 'whyus-8', 'whyus-5', 'whyus-3', 'whyus-4', 'whyus-6'];

export async function WhyChooseUs() {
  const t = await getTranslations('WhyChooseUs');
  const items = t.raw('items') as { title: string; desc: string }[];

  return (
    <section className={s.whychooseus}>
      <div className={cn('container', s.container)}>
        <h2 dangerouslySetInnerHTML={{ __html: t.raw('heading') }} />
        <div className="redline"></div>
        <a id="volumecalculatoranchor" className="anchor"></a>
        <div className={cn('row', s.row)}>
          <div className={cn('col col-8', s.col8, s.col)}>
            {items.map((item, i) => (
              <div className={s.whyusItem} key={item.title}>
                <Icon name={ICONS[i]} />
                <div className={s.whyusInfo}>
                  <div className={s.txt}>{item.title}</div>
                  <div className={s.desc}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className={cn('col col-4', s.calcBlock, s.col)}>
            <div className={s.heading}>
              <h3>{t('calculatorTitle')}</h3>{' '}
              <a href="">
                <Icon name="info" />
              </a>
            </div>
            <p>{t('calculatorSubtitle')}</p>

            <Calculator />
          </div>
        </div>
      </div>
    </section>
  );
}
