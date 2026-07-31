import { formatDate, formatDateTime } from '@/lib/parcels/format';
import type { ParcelListItem } from '@/lib/parcels/types';
import s from './ParcelTrackingCell.module.css';

// The "Tracking" column: the parcel's milestone timeline, plus the on-hold banner above it.
// Rows, labels and order are taken from views/parcels/vwParcels_work2.cfm's inner
// `<table class="table2">`; the ones legacy shows with a time as well as a date are the ones
// operators time to the minute.
//
// Legacy also carried a Georgian translation for six of these labels, switched on
// `session.language`. The bema panel has no language switch (docs/decisions/0011), so they
// are English here; when the panel does get one, this is the list that needs the messages
// file, not a second copy of the markup.
const MILESTONES: { key: keyof ParcelListItem; label: string; withTime?: boolean }[] = [
  { key: 'trackingAway', label: 'Awaiting' },
  { key: 'trackingReceived', label: 'Received in USA' },
  { key: 'trackingEstDelivery', label: 'Estimate Delivery' },
  { key: 'trackingEstShip', label: 'Estimate Shipping' },
  { key: 'trackingShipped', label: 'Shipped' },
  { key: 'trackingDelay', label: 'Delay' },
  { key: 'trackingProcessingCustom', label: 'On hold by custom', withTime: true },
  { key: 'trackingCustom', label: 'Ongoing customs process' },
  { key: 'trackingOffice', label: 'In Office', withTime: true },
  { key: 'trackingOutDelivery', label: 'Out Delivery', withTime: true },
  { key: 'trackingSendRegion', label: 'Send Region', withTime: true },
  { key: 'trackingDeliveredSigned', label: 'Delivered', withTime: true },
];

export function ParcelTrackingCell({ parcel, onConfirmHold }: { parcel: ParcelListItem; onConfirmHold: () => void }) {
  return (
    <>
      {parcel.status === 'OnHold' && <b className={s.onHold}>On Hold</b>}
      {parcel.status === 'NotOnHold' && (
        <span className={s.notOnHold}>
          <b>Removed from On Hold</b>{' '}
          {/* Clears both hold flags so the parcel drops out of the hold queues — legacy's
              `parcels.cfm?rid=…&status=notonhold` link, which ran the UPDATE inline in the
              list page itself. */}
          <button type="button" className={s.confirm} onClick={onConfirmHold}>
            Confirm
          </button>
        </span>
      )}

      <table className={s.timeline}>
        <tbody>
          {MILESTONES.map(({ key, label, withTime }) => {
            const value = parcel[key] as string | null;
            return (
              <tr key={key}>
                <td className={s.label}>{label}:</td>
                <td className={s.value}>{withTime ? formatDateTime(value) : formatDate(value)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
