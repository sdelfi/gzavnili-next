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
// Edit, View, Print, Scan, Delete, Send SMS (docs/decisions/0024-bema-send-sms.md), and the
// public tracking popup are wired. View/Print/Scan open in a small popup window, matching
// legacy's own `window.open(...)` (see docs/decisions/0029-parcels-barcode-print.md). The
// rest target bema screens that have not been ported yet (the statements module's invoice
// and history popups, the Resend SMS composer); they are rendered inert with a title rather
// than dropped, so the row shows the actions this screen is supposed to have and nothing
// silently 404s — the same convention the sidebar uses for not-yet-built pages.
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
  const trackingNum = parcel.trackingNum;

  return (
    <div className={s.actions}>
      <Link className={s.action} href={`${routes.bema.parcelEdit(parcel.id)}?returnTo=${encodeURIComponent(returnTo)}`}>
        Edit
      </Link>
      <Link className={s.action} href={routes.bema.parcelView(parcel.id)} target="_blank">
        View
      </Link>
      <Button
        type="button"
        variant="plain"
        className={s.action}
        onClick={() =>
          window.open(routes.bema.parcelPrint([parcel.id]), 'vieworder', 'width=640,height=480,scrollbars=yes')
        }
      >
        Print
      </Button>
      <Button type="button" variant="plain" className={cn(s.action, s.danger)} onClick={onDelete}>
        Delete
      </Button>
      {parcel.invoiceId && <PendingAction label="View Invoice" />}
      <PendingAction label="View History" />
      {trackingNum && (
        <Button
          type="button"
          variant="plain"
          className={s.action}
          onClick={() => window.open(routes.bema.parcelScan(trackingNum), 'viewhistory', 'width=640,height=480,scrollbars=yes')}
        >
          Scan
        </Button>
      )}
      <Link
        className={s.action}
        href={
          parcel.trackingNum
            ? `${routes.bema.smsAdd()}?trackingnum=${encodeURIComponent(parcel.trackingNum)}`
            : routes.bema.smsAdd()
        }
      >
        Send SMS
      </Link>
      <PendingAction label="Resend SMS" />
      {/* todo: implement */}
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
