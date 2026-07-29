import { getTranslations } from 'next-intl/server';
import { FaqAccordion } from '@/components/FaqAccordion';
import { HomeHero } from '@/components/HomeHero';
import { MobileApp } from '@/components/MobileApp';
import { News } from '@/components/News';
import { OfferParallax } from '@/components/OfferParallax';
import { TrustUs } from '@/components/TrustUs';
import { VideoTutorials } from '@/components/VideoTutorials';
import { WhyChooseUs } from '@/components/WhyChooseUs';
import { Link } from '@/i18n/navigation';
import { routes } from '@/lib/routes';

// Rebuilt from the real cached homepage content (see PROGRESS.md):
// ../http/include/pages/14FE4559026D4C5B5EB530EE70300C52D99E70D7.json, `content` field —
// the actual server-rendered output for `/index.html`, cross-checked against
// https://usa.gzavnili.com/. The previous version of this file was ported from
// `views/home.html`, which turned out to be dead code (never included by the live layout).
export default async function Home() {
  const t = await getTranslations('Faq');
  const faqItems = t.raw('items') as { question: string; answer: string }[];

  return (
    <>
      <HomeHero />
      <TrustUs />

      <OfferParallax />

      <WhyChooseUs />

      <div className="container">
        <div className="row faq-quesions-block">
          <section className="col col-6 faq">
            <h3>{t('heading')}</h3>

            <FaqAccordion items={faqItems} />

            <div className="ralign">
              <p>
                <Link href={routes.page('faq')}>{t('seeAllAnswers')}</Link>
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
