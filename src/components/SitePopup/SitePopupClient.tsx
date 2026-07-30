'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/Modal';

// "Don't show again for a while" cookie — matches legacy's own `showpopup` cookie name and
// 2-hour expiry (`DateAdd("h", 2, now())` in views/layouts/new.html) exactly, so a visitor
// who already dismissed it on the legacy site during a migration window won't get it again
// here either.
const COOKIE_NAME = 'showpopup';
const COOKIE_MAX_AGE_SECONDS = 2 * 60 * 60;

function hasCookie(name: string) {
  return document.cookie.split('; ').some((c) => c.startsWith(`${name}=`));
}

export function SitePopupClient({ message }: { message: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    Promise.resolve().then(() => {
      if (!hasCookie(COOKIE_NAME)) setOpen(true);
    });
  }, []);

  function handleClose() {
    document.cookie = `${COOKIE_NAME}=1; max-age=${COOKIE_MAX_AGE_SECONDS}; path=/`;
    setOpen(false);
  }

  return (
    <Modal open={open} onClose={handleClose} variant="w420">
      {/* Admin-authored content (bema Site Settings), same trust boundary as the Site Pages
          CMS content — not user input. */}
      <div dangerouslySetInnerHTML={{ __html: message }} />
    </Modal>
  );
}
