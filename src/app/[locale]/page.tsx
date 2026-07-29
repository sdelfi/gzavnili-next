import { FaqAccordion } from '@/components/FaqAccordion';
import { HomeHero } from '@/components/HomeHero';
import { MobileApp } from '@/components/MobileApp';
import { News } from '@/components/News';
import { OfferParallax } from '@/components/OfferParallax';
import { TrustUs } from '@/components/TrustUs';
import { VideoTutorials } from '@/components/VideoTutorials';
import { WhyChooseUs } from '@/components/WhyChooseUs';
import { routes } from '@/lib/routes';

// Rebuilt from the real cached homepage content (see PROGRESS.md):
// ../http/include/pages/14FE4559026D4C5B5EB530EE70300C52D99E70D7.json, `content` field —
// the actual server-rendered output for `/index.html`, cross-checked against
// https://usa.gzavnili.com/. The previous version of this file was ported from
// `views/home.html`, which turned out to be dead code (never included by the live layout).
const FAQ_ITEMS = [
  {
    question: 'Gzavnilli Shipping Days',
    answer:
      'Both Regular and Express services send parcels three times a week. Express service departure days are Monday, Wednesday, and Saturday while Regular parcels happen on Tuesday, Friday and Sunday.',
  },
  {
    question: 'How long is transit time?',
    answer:
      'Transit time for Express service From New York to Tbilisi is 3 calendar days (from day of departure), for regular shipment average time is 5-7 days.',
  },
  {
    question: 'How can I find office working schedule?',
    answer:
      'We are open throughout the year, except on Easter, Christmas and New Year. Check our contact us page for more details on this.',
  },
  {
    question: 'Does Gzavnilli Offer the Cheapest and Fastest Shipping Service?',
    answer:
      'Absolutely! We offer the cheapest, safest and fastest parcel services from the USA to Georgia. Our shipping services are unique, and no other company can match our standards and efficiency.',
  },
  {
    question: 'Which Payment Methods Does Gzavnilli Accept?',
    answer:
      'We accept almost all type of payments: PayPal, Debit or credit card payment, checks, money orders, cash, bill pay (from your online banking), wire transfer and bank deposit.',
  },
];

export default function Home() {
  return (
    <>
      <HomeHero />
      <TrustUs />

      <OfferParallax />

      <WhyChooseUs />

      <div className="container">
        <div className="row faq-quesions-block">
          <section className="col col-6 faq">
            <h3>Frequently Asked Questions</h3>

            <FaqAccordion items={FAQ_ITEMS} />

            <div className="ralign">
              <p>
                <a href={routes.page('faq')}>See all answers</a>
              </p>
            </div>
          </section>

          <VideoTutorials />
        </div>
      </div>

      <MobileApp />
      <News />
    </>
  );
}
