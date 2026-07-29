'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';
import s from './OfferParallax.module.css';

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
          <h2>Special offer!</h2>
          <p>
            Enjoy great Deals, Discounts and Coupons when you shop from our partner online stores. You may just get your
            shipping costs covered by coupons and discounts received while shopping at our partner stores.
          </p>
          <div className={s.redline}></div>

          <div className="btn-block">
            <a href="" className="btn btn-red">
              Get Started Now! <i className="icon icon-arr1"></i>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
