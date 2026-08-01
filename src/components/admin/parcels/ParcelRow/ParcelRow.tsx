'use client';

import cn from 'classnames';
import { Checkbox } from '@/components/ui/admin/Checkbox';
import { TableSurface } from '@/components/ui/admin/Table';
import { ParcelPaymentCell } from '@/components/admin/parcels/ParcelPaymentCell';
import { ParcelTrackingCell } from '@/components/admin/parcels/ParcelTrackingCell';
import { ParcelRowActions } from '@/components/admin/parcels/ParcelRowActions';
import { serviceLabel } from '@/lib/parcels/constants';
import { formatAmount, formatDate, formatDateTime } from '@/lib/parcels/format';
import type { ParcelListItem } from '@/lib/parcels/types';
import s from './ParcelRow.module.css';

// One parcel: the ten-column row inside a shipment card, ported from the `<cfloop
// query="parcels">` body in views/parcels/vwParcels_work2.cfm. The two columns with real
// logic behind them (Debt and Tracking) are their own components; the rest are the parcel's
// own fields, printed only when set — which is what makes this dense list readable at all.

/** Specifications: the dimension rows only appear once a parcel has been measured, matching
 *  legacy's `<cfif val(parcels.dimweight)>` guard. */
function Specifications({ parcel }: { parcel: ParcelListItem }) {
  const rows: [string, string][] = [
    ['Weight:', formatAmount(parcel.weight)],
    ['Value:', formatAmount(parcel.value)],
  ];
  if (parcel.dimWeight) {
    rows.push(
      ['Length:', formatAmount(parcel.length)],
      ['Width:', formatAmount(parcel.width)],
      ['High:', formatAmount(parcel.high)],
      ['Dim Weight:', formatAmount(parcel.dimWeight)],
    );
  }
  if (parcel.isPaid) rows.push(['Paid:', formatAmount(parcel.debt)]);
  if (parcel.service) rows.push(['Service:', serviceLabel(parcel.service)]);
  if (parcel.officeName) rows.push(['Ge Delivery Office:', parcel.officeName]);
  if (parcel.tripDate) rows.push(['Trip Date:', formatDate(parcel.tripDate)]);

  return (
    <TableSurface className={s.specs} scrollable={false}>
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label}>
            <td className={s.specLabel}>{label}</td>
            <td className={s.specValue}>{value}</td>
          </tr>
        ))}
      </tbody>
    </TableSurface>
  );
}

/** Receiver block: every populated line of the delivery address, one per line. */
function Receiver({ parcel }: { parcel: ParcelListItem }) {
  const r = parcel.receiver;
  if (!r) return null;

  const latin = [r.firstName, r.lastName].filter(Boolean).join(' ');
  const georgian = [r.firstNameGe, r.lastNameGe].filter(Boolean).join(' ');
  const lines = [r.street1, r.street2, r.city, r.state, r.postalCode, r.country, r.phone1, r.phone2, r.phone3];

  return (
    <>
      {latin && <div>{latin}</div>}
      {georgian && <div>GE: {georgian}</div>}
      {lines.filter(Boolean).map((line, i) => (
        <div key={`${line}-${i}`}>{line}</div>
      ))}
    </>
  );
}

export function ParcelRow({
  parcel,
  index,
  selected,
  onToggle,
  onDelete,
  onConfirmHold,
  lariRate,
  returnTo,
  showBuser,
}: {
  parcel: ParcelListItem;
  index: number;
  selected: boolean;
  onToggle: (selected: boolean) => void;
  onDelete: () => void;
  onConfirmHold: () => void;
  lariRate: number | null;
  returnTo: string;
  /** Delivery Request mode adds the column showing who took the parcel out. */
  showBuser: boolean;
}) {
  return (
    <tr className={cn(index % 2 === 0 ? s.even : s.odd, { [s.selected]: selected })}>
      <td className={s.center}>
        <Checkbox checked={selected} onChange={(e) => onToggle(e.target.checked)} aria-label="Select parcel" />
      </td>
      <td className={s.center}>{parcel.groupId}</td>

      <td>
        <span className={s.tracking}>{parcel.trackingNum}</span>
        {parcel.trackingNum2 && <div className={s.muted}>{parcel.trackingNum2}</div>}
        {parcel.trackingReceived && <div className={s.muted}>Received: {formatDateTime(parcel.trackingReceived)}</div>}
        {parcel.trackingDeliveredSigned && (
          <div className={s.muted}>Delivered: {formatDateTime(parcel.trackingDeliveredSigned)}</div>
        )}
      </td>

      <td>
        <Specifications parcel={parcel} />
      </td>

      <td className={s.right}>
        <ParcelPaymentCell parcel={parcel} lariRate={lariRate} />
      </td>

      <td className={s.wrap}>
        <Receiver parcel={parcel} />
      </td>

      <td className={s.noPadding}>
        <ParcelTrackingCell parcel={parcel} onConfirmHold={onConfirmHold} />
      </td>

      <td className={s.wrap}>{parcel.contents}</td>

      <td className={s.wrap}>
        {parcel.location && <div>Location: {parcel.location}</div>}
        {parcel.additionalUsername && <div>UserID: {parcel.additionalUsername}</div>}
        {parcel.additionalFirstname && <div>Firstname: {parcel.additionalFirstname}</div>}
        {parcel.additionalLastname && <div>Lastname: {parcel.additionalLastname}</div>}
        {parcel.notes}
      </td>

      {showBuser && <td className={s.wrap}>{parcel.buserName}</td>}

      <td>
        <ParcelRowActions parcel={parcel} returnTo={returnTo} onDelete={onDelete} />
      </td>
    </tr>
  );
}
