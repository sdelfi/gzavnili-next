import cn from 'classnames';
import { getTranslations } from 'next-intl/server';
import { Calculator } from '@/components/Calculator';
import s from './WhyChooseUs.module.css';
// Icons are positional (not part of the translated content) — index-matched to the
// `WhyChooseUs.items` array in messages/*.json.
const ICONS = [
  'icon-whyus-1',
  'icon-whyus-7',
  'icon-whyus-2',
  'icon-whyus-8',
  'icon-whyus-5',
  'icon-whyus-3',
  'icon-whyus-4',
  'icon-whyus-6',
];

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
                <i className={`icon ${ICONS[i]}`}></i>
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
                <i className="icon icon-info"></i>
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
