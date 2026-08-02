'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import cn from 'classnames';
import { getParcel, listDeliveryOffices, parcelBarcodeUrl, parcelQrCodeUrl } from '@/lib/api/bema/parcels';
import type { ParcelDetail } from '@/lib/services/parcelDetail';
import { formatAmount, formatDate, formatDollar } from '@/lib/parcels/format';
import s from './ParcelPrintPage.module.css';

// bema "Print Labels" (`bema/parcels/parcels-print.cfm` + `views/parcels/vwParcelsPrint.cfm`)
// — one shipping label per parcel id (comma-separated in `?parcels=`), opened in a small
// popup that auto-triggers `window.print()`. See docs/decisions/0029-parcels-barcode-print.md.
//
// Not reproduced: legacy's own commented-out fallback layout (the `<!--- ... --->` block with
// the two-office-address footer) — it was already dead in the source.

function serviceLetter(service: string): string {
  const first = service.charAt(0).toUpperCase();
  if (first === 'E') return 'E';
  if (first === 'C') return 'C';
  return 'R';
}

function Label({ parcel, officeLetter }: { parcel: ParcelDetail; officeLetter: string }) {
  return (
    <div className={s.label}>
      {parcel.trackingNum && (
        <div className={s.header}>
          <div className={s.badge}>
            {officeLetter && <span className={s.badgeOffice}>{officeLetter}</span>}
            {serviceLetter(parcel.service)}
          </div>
          <div className={s.barcodeCol}>
            <img src={parcelBarcodeUrl(parcel.trackingNum, 50)} alt={parcel.trackingNum} />
            <div className={cn(s.trackingNum, parcel.trackingNum.length > 12 ? s.trackingNumSmall : undefined)}>
              {parcel.trackingNum}
            </div>
          </div>
        </div>
      )}

      <img src="/img/print_address.jpg" width={440} alt="" />

      <table className={s.addressTable}>
        <tbody>
          <tr>
            <td className={s.receiverCell}>
              <div className={s.receiverName}>
                {parcel.receiver.firstName}
                <br />
                {parcel.receiver.lastName}
              </div>
              {parcel.receiver.street1}
              <br />
              {parcel.receiver.state && <>{parcel.receiver.state}, </>}
              {parcel.receiver.city}
              <br />
              {parcel.receiver.phone1 && (
                <>
                  Tel {parcel.receiver.phone1}
                  <br />
                </>
              )}
              {parcel.receiver.phone2 && (
                <>
                  Tel {parcel.receiver.phone2}
                  <br />
                </>
              )}
            </td>
            <td className={s.qrCell}>
              {parcel.contents && parcel.trackingNum && (
                <img src={parcelQrCodeUrl(parcel.trackingNum, 150)} alt="" />
              )}
            </td>
          </tr>
        </tbody>
      </table>

      <div className={s.datesBox}>
        <table className={s.datesTable}>
          <tbody>
            <tr>
              <td className={s.datesLeft}>
                DEPARTURE DATE
                <br />
                {formatDate(parcel.trackingReceived)}
              </td>
              <td className={s.datesRight}>
                RECEIVE DATE
                <br />
                {formatDate(parcel.trackingEstDelivery)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className={s.datesBox}>
        <table className={s.datesTable}>
          <tbody>
            <tr>
              <td className={s.statBox}>
                WEIGHT
                <br />
                <span className={s.statValue}>{formatAmount(parcel.weight)}</span>
              </td>
              <td className={s.statBox}>
                VALUE
                <br />
                <span className={s.statValue}>{formatDollar(parcel.value)}</span>
              </td>
              <td className={s.statBox}>
                {parcel.isPaid ? 'PAID' : 'DEBT'}
                <br />
                <span className={s.statValue}>{formatDollar(parcel.debt)}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <img src="/img/print_site.jpg" width={440} alt="" />
    </div>
  );
}

export function ParcelPrintPage() {
  const searchParams = useSearchParams();
  const parcelsParam = searchParams.get('parcels') ?? '';

  const [parcels, setParcels] = useState<ParcelDetail[] | null>(null);
  const [officeLetters, setOfficeLetters] = useState<Record<string, string>>({});

  useEffect(() => {
    const ids = parcelsParam.split(',').filter(Boolean);
    if (ids.length === 0) {
      Promise.resolve().then(() => setParcels([]));
      return;
    }
    Promise.all(ids.map((id) => getParcel(id).then((data) => data.parcel)))
      .then(setParcels)
      .catch(() => setParcels([]));
    listDeliveryOffices()
      .then((data) => {
        const map: Record<string, string> = {};
        for (const office of data.offices) if (office.letter) map[office.id] = office.letter.trim();
        setOfficeLetters(map);
      })
      .catch(() => setOfficeLetters({}));
  }, [parcelsParam]);

  useEffect(() => {
    if (parcels && parcels.length > 0) window.print();
  }, [parcels]);

  if (!parcels) return <div>Loading…</div>;

  return (
    <div>
      {parcels.map((parcel) => (
        <Label key={parcel.id} parcel={parcel} officeLetter={officeLetters[parcel.officeId] ?? ''} />
      ))}
    </div>
  );
}
