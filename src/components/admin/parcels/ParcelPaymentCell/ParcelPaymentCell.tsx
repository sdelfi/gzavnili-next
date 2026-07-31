import { formatWithLari } from '@/lib/parcels/format';
import type { ParcelListItem } from '@/lib/parcels/types';
import s from './ParcelPaymentCell.module.css';

// The "Debt" column: what is still owed, or — once the parcel has been invoiced — how it was
// paid. Ported from views/parcels/vwParcels_work2.cfm's `<td class="redbold">`.
//
// One legacy branch is deliberately not reproduced. When an invoiced parcel had no
// `payMethod1` of its own, legacy ran two more queries per row to dig the method out of the
// `payments` table, and — failing that — guessed it from the *length* of the transaction id
// (32 or 16 chars → "Credit Card", 17 → "PayPal", 12 → "Authorize.net"). That is a guess
// about historical rows, not a rule; this schema records the method on the parcel when the
// payment is taken (see applyPaidOperation), so there is nothing to reconstruct. Rows
// imported from legacy without a method will show "—" instead of a guess.

/** An online payment source outranks the recorded method, and cash/card taken in the US is
 *  labelled as such — the same two rules the CSV export applies. */
function payMethodLabel(parcel: ParcelListItem): string | null {
  if (parcel.onlineSource && parcel.onlineSource.length > 1) {
    return parcel.onlineSource.replace('Credit Card', 'CC Online');
  }
  // `Debt` is a placeholder legacy writes when an invoice was raised against the account
  // balance rather than a real payment — not a payment method to display.
  if (parcel.payMethod1 && parcel.payMethod1.length > 1 && parcel.payMethod1 !== 'Debt') {
    return parcel.payMethod1 === 'Cash' || parcel.payMethod1 === 'Creditcard'
      ? `${parcel.payMethod1} US`
      : parcel.payMethod1;
  }
  return null;
}

export function ParcelPaymentCell({ parcel, lariRate }: { parcel: ParcelListItem; lariRate: number | null }) {
  const method = payMethodLabel(parcel);
  const outstanding = !parcel.isPaid || (!method && parcel.payMethod1 === 'Debt');

  // What was actually charged: the recorded pay amount, or the full debt when the parcel was
  // settled without one being written down.
  const paidAmount = parcel.payAmount1 && parcel.payAmount1 !== 0 ? parcel.payAmount1 : parcel.debt;

  // A partial payment is only worth showing when it isn't simply the whole amount again.
  const showPartial = parcel.payMethod2 && paidAmount !== parcel.debt;

  return (
    <>
      {outstanding ? (
        <p className={s.debt}>{formatWithLari(parcel.debt, lariRate)}</p>
      ) : (
        <p className={s.paid}>
          <b>Pay Method:</b> {method ?? '—'}
          <br />
          <b>Pay Amount:</b> {formatWithLari(paidAmount, lariRate)}
        </p>
      )}

      {showPartial && (
        <p className={s.partial}>
          <b>Partial Paid:</b>
          <br />
          <b>Pay Method:</b> {parcel.payMethod2}
          <br />
          <b>Pay Amount:</b> {formatWithLari(parcel.payAmount2, lariRate)}
        </p>
      )}
    </>
  );
}
