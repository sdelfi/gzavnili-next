'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import s from './OfferParallax.module.css';
import cn from 'classnames';
import { Icon } from '@/components/ui/Icon';

// Replaces additional.js: $('#offer-parallax').parallax_bg("50%", 0.3, 615);
// (../http/js/jquery.parallax-bg.js) — shifts the background image vertically as the section
// scrolls through the viewport. The image itself moved from a CSS `background: url()` (see
// public/css/additional.css) to next/image so Next can serve a responsive, modern-format
// (AVIF/WebP) version instead of one flat full-size JPEG to every visitor/format — see
// docs/decisions/0007-next-image-for-css-backgrounds.md. `z-index: -1` keeps it behind the
// normal-flow `.container` content despite being `position: absolute` (via `fill`) — an
// absolutely positioned element with `z-index: auto` still paints above static siblings,
// negative z-index is what puts it back behind them.
export function OfferParallax() {
  const t = useTranslations('SpecialOffer');
  const sectionRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const image = imageRef.current;
    if (!section || !image) return;
    const firstTop = section.getBoundingClientRect().top + window.scrollY;
    const speedFactor = 0.3;

    const update = () => {
      const y = Math.round((firstTop - window.scrollY) * speedFactor);
      image.style.transform = `translateY(${y}px)`;
    };

    window.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    update();

    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return (
    <section className={s.specialoffer} ref={sectionRef}>
      <div className="container">
        <div className={s.txt}>
          <h2>{t('heading')}</h2>
          <p>{t('text')}</p>
          <div className={cn('redline', s.redline)}></div>

          <div className="btn-block">
            <a href="" className="btn btn-red">
              {t('cta')} <Icon name="arr1" inButton />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
