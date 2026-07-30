'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// A CMS-content placeholder (`{CALCULATOR}`, `{QUOTEFORM}`, `{QUESTIONFORM}`, ...) can sit
// inside a still-open parent element (e.g. `<div class="cargoform">{QUOTEFORM}</div>` — see
// PageContent.tsx's comment). Splitting the HTML string there and rendering each half through
// its own `dangerouslySetInnerHTML` would let the browser auto-close that dangling parent at
// each fragment's boundary, breaking the surrounding markup/styling. Rendering the *entire*
// content in one pass (with the placeholder swapped for an inert marker div carrying
// `slotAttr`) keeps the original nesting intact; this component then portals the real
// interactive React content into that marker after mount, instead of trying to inject JSX
// mid-string.
export function SlotPortal({ slotAttr, children }: { slotAttr: string; children: React.ReactNode }) {
  const [slot, setSlot] = useState<Element | null>(null);

  useEffect(() => {
    Promise.resolve().then(() => {
      setSlot(document.querySelector(`[${slotAttr}]`));
    });
  }, [slotAttr]);

  if (!slot) return null;
  return createPortal(children, slot);
}
