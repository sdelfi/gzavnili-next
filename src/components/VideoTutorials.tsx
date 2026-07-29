'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Lightbox } from '@/components/ui/Lightbox';

// The real homepage content wires these up as `.fancybox.iframe` (jquery.fancybox.js) — see
// src/components/ui/Lightbox.tsx for the plain-React/CSS recreation of fancybox's look used
// here instead.
// embedUrl/image are positional (not translated) — index-matched to `VideoTutorials.videos`
// in messages/*.json.
const VIDEO_META = [
  { embedUrl: 'https://www.youtube.com/embed/ZuWziJarrEY', image: '/img/hiw/1.png' },
  { embedUrl: 'https://www.youtube.com/embed/dmarenxn5sQ', image: '/img/hiw/2.png' },
  { embedUrl: '', image: '/img/hiw/3.png' },
  { embedUrl: 'https://www.youtube.com/embed/z_6LItMQkp4', image: '/img/hiw/4.png' },
];

export function VideoTutorials() {
  const t = useTranslations('VideoTutorials');
  const titles = (t.raw('videos') as { title: string }[]).map((v) => v.title);
  const videos = VIDEO_META.map((meta, i) => ({ ...meta, title: titles[i] }));
  const [open, setOpen] = useState<(typeof videos)[number] | null>(null);

  return (
    <section className="col col-6 videohelp">
      <h3>{t('heading')}</h3>
      <div className="videos">
        {videos.map((video) => (
          <a
            key={video.title}
            className="item"
            href={video.embedUrl || undefined}
            onClick={(e) => {
              if (!video.embedUrl) return;
              e.preventDefault();
              setOpen(video);
            }}
          >
            <div className="inner">
              <p>{video.title}</p>
              <div className="img">
                <Image alt={video.title} src={video.image} width={166} height={91} />
              </div>
              <span>{t('watchVideo')}</span>
            </div>
          </a>
        ))}
      </div>

      <Lightbox open={!!open} onClose={() => setOpen(null)}>
        {open && (
          <iframe
            width="640"
            height="360"
            src={open.embedUrl}
            title={open.title}
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        )}
      </Lightbox>
    </section>
  );
}
