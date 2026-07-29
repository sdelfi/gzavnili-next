"use client";

import { useEffect, useRef } from "react";

// Replaces additional.js: $('#offer-parallax').parallax_bg("50%", 0.3, 615);
// (../http/js/jquery.parallax-bg.js) — shifts the background-position vertically as the
// section scrolls through the viewport. Same markup/class so css/additional.css applies.
export function OfferParallax({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const firstTop = el.getBoundingClientRect().top + window.scrollY;
    const speedFactor = 0.3;

    const update = () => {
      const y = Math.round((firstTop - window.scrollY) * speedFactor);
      el.style.backgroundPosition = `50% ${y}px`;
    };

    window.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    update();
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <section className="specialoffer" id="offer-parallax" ref={ref}>
      {children}
    </section>
  );
}
