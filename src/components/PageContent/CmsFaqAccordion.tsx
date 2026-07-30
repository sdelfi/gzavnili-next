'use client';

import { useEffect } from 'react';
import { CMS_CONTENT_ATTR } from './constants';

// CMS content (`.faq-item`/`.question`/`.answer`, see public/css/static.css) is rendered as
// plain admin-authored HTML with no attached behavior — legacy's main.js handler
// (`$('.faq-item .question').click(...)`, already ported for the home page's own FAQ as
// `FaqAccordion.tsx`) never ran on it, so the accordion looked inert: `.answer` visibility is
// driven purely by the parent `.faq-item`'s `active` class in CSS, and nothing ever toggled
// that class. This reproduces the same toggle via event delegation on the CMS content
// container instead of re-rendering the (arbitrary, admin-authored) markup as React.
export function CmsFaqAccordion() {
  useEffect(() => {
    const container = document.querySelector(`[${CMS_CONTENT_ATTR}]`);
    if (!container) return;

    function handleClick(e: Event) {
      const question = (e.target as Element).closest('.faq-item .question');
      const item = question?.closest('.faq-item');
      const list = item?.closest('.faq-list');
      if (!item || !list) return;

      const wasActive = item.classList.contains('active');
      list.querySelectorAll(':scope > .faq-item.active').forEach((el) => el.classList.remove('active'));
      if (!wasActive) item.classList.add('active');
    }

    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
  }, []);

  return null;
}
