'use client';

import { useEffect, useState } from 'react';
import { getTripInfo, type TripInfoResponse } from '@/lib/api/bema/config';
import { formatDate } from '@/lib/parcels/format';
import s from './ParcelTripInfo.module.css';

// The EXPRESS/REGULAR/CARGO panel at the top of the batch "Add Parcel" screen — read-only
// trip info (`views/vwParcelsAdd.cfm`'s header block, above the "Add Parcel" heading).

const COLUMNS: { key: keyof TripInfoResponse; label: string }[] = [
  { key: 'express', label: 'EXPRESS' },
  { key: 'regular', label: 'REGULAR' },
  { key: 'cargo', label: 'CARGO' },
];

export function ParcelTripInfo() {
  const [data, setData] = useState<TripInfoResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    getTripInfo()
      .then((res) => !cancelled && setData(res))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={s.panel}>
      {COLUMNS.map(({ key, label }) => {
        const trip = data?.[key];
        return (
          <div key={key} className={s.column}>
            <h2 className={s.label}>{label}</h2>
            <p>Ship day: {formatDate(trip?.shipDate)}</p>
            <p>Estimate: {formatDate(trip?.estimateDate)}</p>
            <p>AVB: {trip?.awb ?? ''}</p>
          </div>
        );
      })}
    </div>
  );
}
