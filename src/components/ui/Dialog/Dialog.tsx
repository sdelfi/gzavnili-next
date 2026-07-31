'use client';

import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import s from './Dialog.module.css';

// A generic modal dialog for the bema admin panel — the batch "Add Parcel" screen's per-
// parcel editor is the first thing that needs one (legacy: a Bootstrap `.modal`, see
// `views/parcels/vwParcelsAdd.cfm`'s `#addParcel`). Its own component, not a Bootstrap port,
// since bema's admin UI already doesn't load Bootstrap's JS/CSS (see `Modal.tsx`'s featherlight
// note for the equivalent decision on the public site).
export function Dialog({
  open,
  onClose,
  title,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
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
    <div className={s.overlay} role="dialog" aria-modal="true">
      <div className={s.dialog}>
        <div className={s.header}>
          <h4 className={s.title}>{title}</h4>
          <button type="button" className={s.close} onClick={onClose} aria-label="Close">
            &#10005;
          </button>
        </div>
        <div className={s.body}>{children}</div>
        {footer && <div className={s.footer}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
