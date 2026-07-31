import type { ParcelDetail } from '@/lib/services/parcelDetail';
import type { UpdateParcelPayload } from '@/lib/validation/parcelSchema';

// The parcel edit form's own state shape, plus the two conversions around it: what the API
// returns → what the inputs bind to → what gets sent back.
//
// Numbers are strings here on purpose. A weight field that holds `number | null` has to
// decide what "" and "1." and "-" mean on every keystroke, and either fights the user's
// typing or silently drops characters. Keeping the raw text and parsing once, at submit,
// is the only version that behaves.

export type ParcelFormState = {
  trackingNum: string;
  trackingNum2: string;
  userId: string;
  userLabel: string;
  tripDate: string;
  service: string;
  awb: string;
  contents: string;
  store: string;

  weight: string;
  value: string;
  length: string;
  width: string;
  high: string;
  dimWeight: string;
  debt: string;

  location: string;
  groupId: string;
  notes: string;
  officeId: string;

  receiver: {
    receiverId: string;
    isGeCitizen: boolean;
    firstName: string;
    lastName: string;
    firstNameGe: string;
    lastNameGe: string;
    organization: string;
    country: string;
    street1: string;
    street2: string;
    city: string;
    state: string;
    postalCode: string;
    phone1: string;
    phone2: string;
    phone3: string;
  };

  customer: {
    firstName: string;
    lastName: string;
    organization: string;
    country: string;
    street1: string;
    street2: string;
    city: string;
    state: string;
    postalCode: string;
    phone1: string;
    phone2: string;
  };

  markPaid: boolean;
  markUnpaid: boolean;
  payMethod1: string;
  payAmount2: string;
  payMethod2: string;

  trackingReceived: string;
  trackingReceivedBy: string;
  trackingAway: string;
  trackingEstDelivery: string;
  trackingEstShip: string;
  trackingShipped: string;
  trackingDelay: string;
  trackingCustom: string;
  trackingProcessingCustom: string;
  trackingOffice: string;
  trackingSendRegion: string;
  trackingOutDelivery: string;
  trackingDeliveredSigned: string;
  trackingDeliveredSignedBy: string;
};

const str = (value: number | null) => (value === null ? '' : String(value));

export function parcelDetailToForm(detail: ParcelDetail): ParcelFormState {
  return {
    trackingNum: detail.trackingNum,
    trackingNum2: detail.trackingNum2,
    userId: detail.userId,
    userLabel: detail.userLabel,
    tripDate: detail.tripDate,
    service: detail.service,
    awb: detail.awb,
    contents: detail.contents,
    store: detail.store,

    weight: str(detail.weight),
    value: str(detail.value),
    length: str(detail.length),
    width: str(detail.width),
    high: str(detail.high),
    dimWeight: str(detail.dimWeight),
    debt: str(detail.debt),

    location: detail.location,
    groupId: detail.groupId,
    notes: detail.notes,
    officeId: detail.officeId,

    receiver: { ...detail.receiver, receiverId: detail.receiver.receiverId ?? '' },
    customer: { ...detail.customer },

    // Never pre-checked: these are actions taken on this save, not stored state. Which of
    // the two the form offers depends on `detail.isPaid`.
    markPaid: false,
    markUnpaid: false,
    payMethod1: detail.payMethod1,
    payAmount2: str(detail.payAmount2),
    payMethod2: detail.payMethod2,

    trackingReceived: detail.trackingReceived,
    trackingReceivedBy: detail.trackingReceivedBy,
    trackingAway: detail.trackingAway,
    trackingEstDelivery: detail.trackingEstDelivery,
    trackingEstShip: detail.trackingEstShip,
    trackingShipped: detail.trackingShipped,
    trackingDelay: detail.trackingDelay,
    trackingCustom: detail.trackingCustom,
    trackingProcessingCustom: detail.trackingProcessingCustom,
    trackingOffice: detail.trackingOffice,
    trackingSendRegion: detail.trackingSendRegion,
    trackingOutDelivery: detail.trackingOutDelivery,
    trackingDeliveredSigned: detail.trackingDeliveredSigned,
    trackingDeliveredSignedBy: detail.trackingDeliveredSignedBy,
  };
}

/** Legacy's "an edit that changes the weight or the amount has to say why" rule, evaluated
 *  against the parcel as loaded rather than against whatever the client claims the old
 *  values were. */
export function notesRequired(form: ParcelFormState, original: ParcelDetail): boolean {
  return form.weight !== str(original.weight) || form.debt !== str(original.debt);
}

export function parcelFormToPayload(form: ParcelFormState, original: ParcelDetail): UpdateParcelPayload {
  return {
    trackingNum: form.trackingNum,
    trackingNum2: form.trackingNum2,
    userId: form.userId,
    tripDate: form.tripDate,
    service: form.service,
    awb: form.awb,
    contents: form.contents,
    store: form.store,

    weight: form.weight,
    value: form.value,
    length: form.length,
    width: form.width,
    high: form.high,
    dimWeight: form.dimWeight,
    debt: form.debt,

    location: form.location,
    groupId: form.groupId,
    notes: form.notes,
    notesRequired: notesRequired(form, original),
    officeId: form.officeId,

    receiver: { ...form.receiver, receiverId: form.receiver.receiverId || null },
    customer: { ...form.customer },

    markPaid: form.markPaid,
    markUnpaid: form.markUnpaid,
    payMethod1: form.payMethod1,
    payAmount2: form.payAmount2,
    payMethod2: form.payMethod2,

    trackingReceived: form.trackingReceived,
    trackingReceivedBy: form.trackingReceivedBy,
    trackingAway: form.trackingAway,
    trackingEstDelivery: form.trackingEstDelivery,
    trackingEstShip: form.trackingEstShip,
    trackingShipped: form.trackingShipped,
    trackingDelay: form.trackingDelay,
    trackingCustom: form.trackingCustom,
    trackingProcessingCustom: form.trackingProcessingCustom,
    trackingOffice: form.trackingOffice,
    trackingSendRegion: form.trackingSendRegion,
    trackingOutDelivery: form.trackingOutDelivery,
    trackingDeliveredSigned: form.trackingDeliveredSigned,
    trackingDeliveredSignedBy: form.trackingDeliveredSignedBy,
  };
}
