import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import s from './News.module.css';

// Images are positional (not translated) — index-matched to `News.items` in messages/*.json.
const NEWS_IMAGES = ['/img/news/ganrigi.jpg', '/img/news/6_times.jpg', '/img/news/choose_a_speed.jpg'];

export async function News() {
  const t = await getTranslations('News');
  const items = t.raw('items') as { title: string; date: string; teaser: string }[];

  return (
    <section className={s.news}>
      <div className="container">
        <h2>{t('heading')}</h2>
        <div className="redline"></div>
        <div className={s.newsList}>
          {items.map((item, i) => (
            <div className={s.item} key={item.title}>
              <span className={s.img}>
                <Image src={NEWS_IMAGES[i]} alt={item.title} width={380} height={199} />
              </span>
              <span className={s.title}>{item.title}</span>
              <div className={s.date}>{item.date}</div>
              <div className={s.teaser}>{item.teaser}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
