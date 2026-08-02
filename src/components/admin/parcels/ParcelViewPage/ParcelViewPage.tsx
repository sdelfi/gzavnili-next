'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import cn from 'classnames';
import { PageHeading } from '@/components/ui/admin/PageHeading';
import { TableSurface } from '@/components/ui/admin/Table';
import { getParcel, getParcelHistory, parcelBarcodeUrl, type ParcelHistoryRow } from '@/lib/api/bema/parcels';
import type { ParcelDetail } from '@/lib/services/parcelDetail';
import { formatAmount, formatDateTime } from '@/lib/parcels/format';
import s from './ParcelViewPage.module.css';

// bema "View Parcel" (`bema/parcels/parcels-view.cfm` + `views/parcels/vwParcelsView.cfm`) —
// a printable single-parcel detail popup: trip/service/tracking with its barcode, weight/
// value/paid-or-debt, sender/receiver, contents, and the parcel's edit-history log. See
// docs/decisions/0029-parcels-barcode-print.md for what wasn't ported (the delivery-
// confirmation signature/photo/GPS section — no schema for it yet).
export function ParcelViewPage() {
  const searchParams = useSearchParams();
  const parcelId = searchParams.get('parcelid') ?? '';

  const [parcel, setParcel] = useState<ParcelDetail | null>(null);
  const [history, setHistory] = useState<ParcelHistoryRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!parcelId) return;
    getParcel(parcelId)
      .then((data) => setParcel(data.parcel))
      .catch(() => setError('Parcel not found.'));
    getParcelHistory(parcelId)
      .then((data) => setHistory(data.history))
      .catch(() => setHistory([]));
  }, [parcelId]);

  if (error) return <div>{error}</div>;
  if (!parcel) return <div>Loading…</div>;

  return (
    <div>
      <PageHeading>View Parcel</PageHeading>

      <table className={s.detail}>
        <tbody>
          <tr>
            <td>Trip Date:</td>
            <td>{parcel.tripDate}</td>
          </tr>
          <tr>
            <td>Service:</td>
            <td className={s.service}>{parcel.service}</td>
          </tr>
          <tr>
            <td>Tracking #:</td>
            <td>{parcel.trackingNum}</td>
          </tr>
          <tr>
            <td></td>
            <td>
              {parcel.trackingNum && <img src={parcelBarcodeUrl(parcel.trackingNum, 50)} alt={parcel.trackingNum} />}
            </td>
          </tr>
          <tr>
            <td colSpan={2}>
              <hr />
            </td>
          </tr>
          <tr>
            <td>Weight:</td>
            <td>{formatAmount(parcel.weight)}</td>
          </tr>
          <tr>
            <td>Value:</td>
            <td>{formatAmount(parcel.value)}</td>
          </tr>
          {!!parcel.dimWeight && (
            <>
              <tr>
                <td>Length:</td>
                <td>{formatAmount(parcel.length)}</td>
              </tr>
              <tr>
                <td>Width:</td>
                <td>{formatAmount(parcel.width)}</td>
              </tr>
              <tr>
                <td>High:</td>
                <td>{formatAmount(parcel.high)}</td>
              </tr>
              <tr>
                <td>Dim Weight:</td>
                <td>{formatAmount(parcel.dimWeight)}</td>
              </tr>
            </>
          )}
          <tr>
            <td>{parcel.isPaid ? 'Paid' : 'Debt'}:</td>
            <td>{formatAmount(parcel.debt)}</td>
          </tr>
          <tr>
            <td>Sender:</td>
            <td>{parcel.userLabel}</td>
          </tr>
          <tr>
            <td className={s.top}>Receiver:</td>
            <td className={s.top}>
              <div>
                {parcel.receiver.firstName} {parcel.receiver.lastName}
              </div>
              {parcel.receiver.street1 && <div>{parcel.receiver.street1}</div>}
              {parcel.receiver.street2 && <div>{parcel.receiver.street2}</div>}
              <div>
                {parcel.receiver.city}
                {parcel.receiver.state ? ',' : ''} {parcel.receiver.state} {parcel.receiver.postalCode} &nbsp;
                {parcel.receiver.country}
              </div>
              {parcel.receiver.phone1 && <div>{parcel.receiver.phone1}</div>}
              {parcel.receiver.phone2 && <div>{parcel.receiver.phone2}</div>}
              {parcel.receiver.phone3 && <div>{parcel.receiver.phone3}</div>}
            </td>
          </tr>
          <tr>
            <td colSpan={2}>
              <hr />
            </td>
          </tr>
          <tr>
            <td className={s.top}>Parcel Contents:</td>
            <td className={cn(s.top, s.wrap)}>{parcel.contents}</td>
          </tr>
        </tbody>
      </table>

      {history.length > 0 && (
        <>
          <h4>History</h4>
          <TableSurface density="compact">
            <thead>
              <tr>
                <th>Date</th>
                <th>Status</th>
                <th>Column</th>
                <th>Old</th>
                <th>New</th>
                <th>Update By</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row, i) => (
                <tr key={i}>
                  <td>{formatDateTime(row.editDateTime)}</td>
                  <td>{row.editStatus}</td>
                  <td>{row.valueName}</td>
                  <td className={s.old}>{row.oldValue}</td>
                  <td className={s.new}>{row.newValue}</td>
                  <td>{row.updaterName}</td>
                </tr>
              ))}
            </tbody>
          </TableSurface>
        </>
      )}
    </div>
  );
}
