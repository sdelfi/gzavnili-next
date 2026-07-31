'use client';

import cn from 'classnames';
import { routes } from '@/lib/routes';
import type { ParcelListItem } from '@/lib/parcels/types';
import s from './ParcelRowActions.module.css';

// The per-row action list (legacy's `» Edit / View / Print / Delete / View Invoice / View
// History / Send SMS / Resend SMS` column).
//
// Only Delete and the public tracking popup are wired: every other target is a bema screen
// that has not been ported yet (parcel edit/view/print, the statements module's invoice and
// history popups, the messages module's SMS forms). They are rendered inert with a title
// rather than dropped, so the row shows the actions this screen is supposed to have and
// nothing silently 404s — the same convention the sidebar uses for not-yet-built pages.
const PENDING_TITLE = 'Not implemented yet';

function PendingAction({ label }: { label: string }) {
  return (
    <span className={cn(s.action, s.pending)} title={PENDING_TITLE}>
      {label}
    </span>
  );
}

export function ParcelRowActions({ parcel, onDelete }: { parcel: ParcelListItem; onDelete: () => void }) {
  return (
    <div className={s.actions}>
      <PendingAction label="Edit" />
      <PendingAction label="View" />
      <PendingAction label="Print" />
      <button type="button" className={cn(s.action, s.danger)} onClick={onDelete}>
        Delete
      </button>
      {parcel.invoiceId && <PendingAction label="View Invoice" />}
      <PendingAction label="View History" />
      <PendingAction label="Send SMS" />
      <PendingAction label="Resend SMS" />
      {parcel.trackingNum && (
        <a
          className={s.action}
          href={`${routes.tracking()}?id=${encodeURIComponent(parcel.trackingNum)}`}
          target="_blank"
          rel="noreferrer"
        >
          Track
        </a>
      )}
    </div>
  );
}
