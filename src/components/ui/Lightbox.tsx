'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import './Lightbox.css';

// Visual replacement for fancybox (jquery.fancybox.js — see ../http/js/fancybox/), which the
// real homepage content wires the video-tutorial thumbnails to via `.fancybox.iframe`. We
// don't load fancybox.js; this reimplements its "skin" (light rounded box, close button
// floating outside the top-right corner, dark overlay) as plain React/CSS — same visual
// language, own markup. Distinct from Modal.tsx (which reuses featherlight's look) because
// they're deliberately different lightbox styles in the legacy design system: featherlight
// for the tracking/login popovers, fancybox for media.
export function Lightbox({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="lightbox-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="lightbox-skin">
        <span className="lightbox-close" onClick={onClose} aria-label="Close">
          &#10005;
        </span>
        <div className="lightbox-inner">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
