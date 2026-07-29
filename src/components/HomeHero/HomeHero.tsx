'use client';

import { useEffect, useRef, useState } from 'react';

import s from './HomeHero.module.css';
import cn from 'classnames';

// Replaces main.js/HomeSlider.tsx, which ported the lightSlider carousel from the dead
// `views/home.html` template (see PROGRESS.md). The real homepage — read from
// `../http/include/pages/14FE4559026D4C5B5EB530EE70300C52D99E70D7.json` (`request.pageContent`
// cache for `/index.html`) and confirmed against https://usa.gzavnili.com/ — has a parallax
// hero instead: car/boxes layers (jquery.parallax.min.js) plus a rotating text strip
// (`#animated-strings`, driven by ../http/js/additional.js). Same markup/classes so
// css/additional.css applies unchanged.
const STRINGS = [
  'All Type of Parcels?',
  'Freight Shipments?',
  'Fastest Shipping?',
  'Pricing Options?',
  'Lowest Price?',
  'Tax-Free Shopping?',
];

const ROTATE_MS = 2000;
const FADE_MS = 1000;

// xparallax/yparallax factors from additional.js:
//   $('.parallax-layer').parallax({}, {xparallax: '40px', yparallax: '10px'}, {xparallax: '20px', yparallax: '5px'})
const LAYERS = [
  { className: s.carObject, x: 40, y: 10 },
  { className: s.boxesObject, x: 20, y: 5 },
];

export function HomeHero() {
  const [active, setActive] = useState(0);
  const [fading, setFading] = useState(false);
  const sceneRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const id = setInterval(() => {
      setFading(true);
      const timeout = setTimeout(() => {
        setActive((i) => (i + 1) % STRINGS.length);
        setFading(false);
      }, FADE_MS);
      return () => clearTimeout(timeout);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const onMouseMove = (e: MouseEvent) => {
      const rect = scene.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width - 0.5;
      const relY = (e.clientY - rect.top) / rect.height - 0.5;
      setOffset({ x: relX, y: relY });
    };
    scene.addEventListener('mousemove', onMouseMove);
    return () => scene.removeEventListener('mousemove', onMouseMove);
  }, []);

  return (
    <section className={s.mainParallax}>
      <div className={s.container}>
        <div className={s.scene} ref={sceneRef}>
          {LAYERS.map((layer) => (
            <div
              key={layer.className}
              className={cn(layer.className, s.parallaxLayer)}
              style={{
                transform: `translate(${offset.x * layer.x}px, ${offset.y * layer.y}px)`,
              }}
            />
          ))}
          <div className={s.textObject}>
            <ul id="animated-strings">
              <li className={fading ? s.fadeup : s.active}>{STRINGS[active]}</li>
            </ul>
            <div className={s.textAnswer}>– Yes!</div>
          </div>
        </div>
      </div>
    </section>
  );
}
