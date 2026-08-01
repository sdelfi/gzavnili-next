'use client';

import Link from 'next/link';
import cn from 'classnames';
import { routes } from '@/lib/routes';
import type { ParcelListItem } from '@/lib/parcels/types';
import { Button } from '@/components/ui/admin/Button';
import s from './ParcelRowActions.module.css';

// The per-row action list (legacy's `» Edit / View / Print / Delete / View Invoice / View
// History / Send SMS / Resend SMS` column).
//
// Edit, Delete and the public tracking popup are wired. The rest target bema screens that
// have not been ported yet (parcel view/print, the statements module's invoice and history
// popups, the messages module's SMS forms); they are rendered inert with a title rather than
// dropped, so the row shows the actions this screen is supposed to have and nothing silently
// 404s — the same convention the sidebar uses for not-yet-built pages.
const PENDING_TITLE = 'Not implemented yet';

function PendingAction({ label }: { label: string }) {
  return (
    <span className={cn(s.action, s.pending)} title={PENDING_TITLE}>
      {label}
    </span>
  );
}

export function ParcelRowActions({
  parcel,
  returnTo,
  onDelete,
}: {
  parcel: ParcelListItem;
  /** Current list URL, so Save/Cancel on the edit screen come back to this exact page —
   *  legacy threads the same thing through as its `rs` param. */
  returnTo: string;
  onDelete: () => void;
}) {
  return (
    <div className={s.actions}>
      <Link className={s.action} href={`${routes.bema.parcelEdit(parcel.id)}?returnTo=${encodeURIComponent(returnTo)}`}>
        Edit
      </Link>
      <PendingAction label="View" />
      <PendingAction label="Print" />
      <Button type="button" variant="plain" className={cn(s.action, s.danger)} onClick={onDelete}>
        Delete
      </Button>
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
