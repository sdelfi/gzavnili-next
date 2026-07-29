import Image from 'next/image';
import s from './News.module.css';

const NEWS_ITEMS = [
  {
    image: '/img/news/ganrigi.jpg',
    title: 'More care on faster transit!',
    date: 'November 14th, 2016',
    teaser:
      'Very excited to inform you, that for Express service we started using Block Space service. That means we are buying space every time on all flights from USA to Georgia, which virtually eliminates the delay if the flight is not canceled.',
  },
  {
    image: '/img/news/6_times.jpg',
    title: 'We do most frequent shipping!',
    date: 'September 5th, 2016',
    teaser:
      'We are pleased to announce to the friends and supporters of Gzavnili LLC the release of the most frequent parcel service from USA to Georgia. There are 3 airlines involved in this service, with six connection fights. This service is available for all faithful customers with promise of best present-day service.',
  },
  {
    image: '/img/news/choose_a_speed.jpg',
    title: 'You select the price and speed!',
    date: 'August 19th, 2016',
    teaser:
      'Another pleasant news for precious customers of the Gzavnili - now can choose how fast do you want to get a parcel from the United States 2 Georgia. At the same time, Gzavnili is guarantee that each type of service always will offer have the lowest price.',
  },
];

export function News() {
  return (
    <section className={s.news}>
      <div className="container">
        <h2>Latest Company News</h2>
        <div className="redline"></div>
        <div className={s.newsList}>
          {NEWS_ITEMS.map((item) => (
            <div className={s.item} key={item.title}>
              <span className={s.img}>
                <Image src={item.image} alt={item.title} width={380} height={199} />
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
