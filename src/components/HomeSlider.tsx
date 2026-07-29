"use client";

import { useEffect, useState } from "react";
import "./HomeSlider.css";

// Replaces the lightSlider plugin call in main.js:
//   $('.homeslider ul.slider').lightSlider({ mode: 'fade', auto: true, pause: 5000, ... })
// Same markup/classes (.homeslider, .lightSlider, .lslide, .slider-controls) so
// css/style.css applies unchanged; the auto-rotation + fade is now plain React state.
type Slide = {
  image: string;
  title: string;
  text: string;
};

const SLIDES: Slide[] = [
  {
    image: "/img/slider-1.jpg",
    title: "Parcel Service",
    text: "Enjoy our supreme parcel services from anywhere in the USA and Georgia. We promise you most frequent, speedy, affordable and reliable shipping services for your parcels. We invite you to experience a unique shipping service from Gzavnilli, efficiency and speedy delivery!",
  },
  {
    image: "/img/tmp/slider-2.jpg",
    title: "Cargo Service",
    text: "Enjoy our supreme parcel services from anywhere in the USA and Georgia. We promise you most frequent, speedy, affordable and reliable shipping services for your parcels.",
  },
  {
    image: "/img/tmp/slider-3.jpg",
    title: "Online Shipping",
    text: "We invite you to experience a unique shipping service from Gzavnilli, efficiency and speedy delivery! Enjoy our supreme parcel services from anywhere in the USA and Georgia.",
  },
  {
    image: "/img/tmp/slider-4.jpg",
    title: "Courier Service",
    text: "We promise you most frequent, speedy, affordable and reliable shipping services for your parcels. We invite you to experience a unique shipping service from Gzavnilli, efficiency and speedy delivery! Enjoy our supreme parcel services from anywhere in the USA and Georgia. We promise you most frequent, speedy, affordable and reliable shipping services for your parcels. We invite you to experience a unique shipping service from Gzavnilli, efficiency and speedy delivery!",
  },
];

const PAUSE_MS = 5000;

export function HomeSlider() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setCurrent((i) => (i + 1) % SLIDES.length), PAUSE_MS);
    return () => clearInterval(id);
  }, [paused]);

  const slide = SLIDES[current];

  return (
    <section
      className="homeslider visible"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <ul className="lightSlider">
        <li className="lslide" key={current} style={{ backgroundImage: `url(${slide.image})` }}>
          <div className="slider-content">
            <div className="container">
              <div className="txt">
                <div className="title">{slide.title}</div>
                <p>{slide.text}</p>
              </div>
            </div>
          </div>
        </li>
      </ul>
      <div className="slider-controls">
        <ul>
          {SLIDES.map((s, i) => (
            <li key={s.title} className={i === current ? "active" : ""}>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setCurrent(i);
                }}
              >
                <i className={`icon icon-slider-${i + 1}`}></i> <span>{s.title}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
