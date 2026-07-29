"use client";

import { useState } from "react";
import { Modal } from "./Modal";

// The real homepage content wires these up as `.fancybox.iframe` (jquery.fancybox.js), which
// we don't load. Reuses the featherlight-styled Modal component for the lightbox instead —
// visually not identical to fancybox, but same open/close behavior with no jQuery plugin.
type Video = { title: string; embedUrl: string; image: string };

const VIDEOS: Video[] = [
  { title: "How it Works?", embedUrl: "https://www.youtube.com/embed/ZuWziJarrEY", image: "/img/hiw/1.png" },
  { title: "How to Declare?", embedUrl: "https://www.youtube.com/embed/dmarenxn5sQ", image: "/img/hiw/2.png" },
  { title: "How to Pay?", embedUrl: "", image: "/img/hiw/3.png" },
  { title: "Where to send?", embedUrl: "https://www.youtube.com/embed/z_6LItMQkp4", image: "/img/hiw/4.png" },
];

export function VideoTutorials() {
  const [open, setOpen] = useState<Video | null>(null);

  return (
    <section className="col col-6 videohelp">
      <h3>Video Tutorials</h3>
      <div className="videos">
        {VIDEOS.map((video) => (
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
                <img alt={video.title} src={video.image} />
              </div>
              <span>Watch video</span>
            </div>
          </a>
        ))}
      </div>

      <Modal open={!!open} onClose={() => setOpen(null)}>
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
      </Modal>
    </section>
  );
}
