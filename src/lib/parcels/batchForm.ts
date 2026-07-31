import type { AddParcelBatchPayload, QuickCustomerPayload } from '@/lib/validation/parcelBatchSchema';

// Form state for the batch "Add Parcel" screen — one customer, several draft parcels held in
// memory until the whole batch is submitted together. Same string-holding convention as
// `./form.ts`'s `ParcelFormState` (numbers stay text until submit) and the same shape for
// `receiver`, so `ParcelReceiverSection` can be reused verbatim for each draft's receiver
// fields.

export type ReceiverFormState = {
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

export function blankReceiver(): ReceiverFormState {
  return {
    receiverId: '',
    isGeCitizen: false,
    firstName: '',
    lastName: '',
    firstNameGe: '',
    lastNameGe: '',
    organization: '',
    country: 'GE',
    street1: '',
    street2: '',
    city: 'Tbilisi',
    state: '',
    postalCode: '',
    phone1: '',
    phone2: '',
    phone3: '',
  };
}

export type DraftParcelFormState = {
  /** Client-only key for React lists and edit/remove targeting — never sent to the server. */
  clientId: string;
  delivery: 'Pickup' | 'Delivery' | 'Region';
  service: 'Regular' | 'Express' | 'Cargo';
  contents: string;
  /** Full value including the D/E delivery+service prefix letters, same as legacy displays
   *  in the tracking-number column. */
  trackingNum: string;
  weight: string;
  value: string;
  groupId: string;
  notes: string;
  officeId: string;
  trackingReceived: string;
  trackingReceivedBy: string;
  notify: boolean;
  receiver: ReceiverFormState;
};

const today = () => new Date().toISOString().slice(0, 10);

/** A brand-new draft's defaults — legacy's `flushParcelFormValues()` plus the group
 *  auto-detect from `#addParcel`'s `show.bs.modal` handler: a new parcel opened while other
 *  drafts already occupy the target group inherits that group's delivery/service. */
export function blankDraftParcel(seed: { groupId?: string; delivery?: DraftParcelFormState['delivery']; service?: DraftParcelFormState['service']; trackingReceivedBy?: string } = {}): DraftParcelFormState {
  return {
    clientId: crypto.randomUUID(),
    delivery: seed.delivery ?? 'Pickup',
    service: seed.service ?? 'Regular',
    contents: '',
    trackingNum: '',
    weight: '',
    value: '',
    groupId: seed.groupId ?? '1',
    notes: '',
    officeId: '',
    trackingReceived: today(),
    trackingReceivedBy: seed.trackingReceivedBy ?? '',
    notify: true,
    receiver: blankReceiver(),
  };
}

export function draftParcelToPayload(draft: DraftParcelFormState): AddParcelBatchPayload['draftParcels'][number] {
  return {
    delivery: draft.delivery,
    service: draft.service,
    contents: draft.contents,
    trackingNum: draft.trackingNum,
    weight: draft.weight,
    value: draft.value,
    groupId: draft.groupId,
    notes: draft.notes,
    officeId: draft.officeId,
    trackingReceived: draft.trackingReceived,
    trackingReceivedBy: draft.trackingReceivedBy,
    notify: draft.notify,
    receiver: { ...draft.receiver, receiverId: draft.receiver.receiverId || null },
  };
}

export type QuickCustomerFormState = {
  userId: string;
  organization: string;
  firstName: string;
  lastName: string;
  email: string;
  country: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  postalCode: string;
  phone1: string;
  phone2: string;
};

export function blankQuickCustomer(): QuickCustomerFormState {
  return {
    userId: '',
    organization: '',
    firstName: '',
    lastName: '',
    email: '',
    country: 'GE',
    street1: '',
    street2: '',
    city: 'Tbilisi',
    state: '',
    postalCode: '',
    phone1: '',
    phone2: '',
  };
}

export function quickCustomerToPayload(form: QuickCustomerFormState): QuickCustomerPayload {
  return { ...form, userId: form.userId || null };
}

/** The subset of the customer box legacy re-saves inside the *final* batch submit
 *  (`userDao.update()` + `saveBillingDefault()` in `parcels-add.cfm`'s POST handler) — name
 *  and billing address only, no email/userId. Redundant with the customer box's own
 *  immediate Save, and kept redundant on purpose (see `parcelBatchAdd.ts`). */
export function quickCustomerToCustomerFields(form: QuickCustomerFormState): AddParcelBatchPayload['customer'] {
  return {
    firstName: form.firstName,
    lastName: form.lastName,
    organization: form.organization,
    country: form.country,
    street1: form.street1,
    street2: form.street2,
    city: form.city,
    state: form.state,
    postalCode: form.postalCode,
    phone1: form.phone1,
    phone2: form.phone2,
  };
}
