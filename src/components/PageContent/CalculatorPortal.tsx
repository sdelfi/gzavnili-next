'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calculator } from '@/components/Calculator';
import { CALCULATOR_SLOT_ATTR } from './constants';

// The `{CALCULATOR}` placeholder can sit inside a still-open parent element in the CMS
// content (e.g. `<div class="calc-block-inner">...{CALCULATOR}</div>` — see PageContent.tsx's
// comment). Splitting the HTML string there and rendering each half through its own
// `dangerouslySetInnerHTML` would let the browser auto-close that dangling parent at each
// fragment's boundary, breaking the `.calc-block` styling around the calculator. Rendering
// the *entire* content in one pass (with the placeholder swapped for an inert marker div)
// keeps the original nesting intact; this component then portals the real interactive
// `Calculator` into that marker after mount, instead of trying to inject JSX mid-string.
export function CalculatorPortal() {
  const [slot, setSlot] = useState<Element | null>(null);

  useEffect(() => {
    Promise.resolve().then(() => {
      setSlot(document.querySelector(`[${CALCULATOR_SLOT_ATTR}]`));
    });
  }, []);

  if (!slot) return null;
  return createPortal(<Calculator />, slot);
}
