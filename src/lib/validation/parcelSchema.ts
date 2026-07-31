import { z } from 'zod';
import { PARCEL_OPERATIONS } from '@/lib/parcels/constants';

// Query/body schemas for the bema parcels endpoints. The filter set is a 1:1 port of the two
// search forms on the legacy `views/parcels/vwParcels_work2.cfm` plus the arguments
// `MSSQLParcelDAO.getParcels()` actually reads — renamed from the legacy querystring keys
// (`kys`/`perpg`/`eadmin`/`edate1`…) to the same readable style the rest of this project's
// list screens use. The legacy `agentPrefix` argument is deliberately absent: it is declared
// in `getParcels()` and passed by `parcels.cfm`, but never referenced by a single line of the
// query — it is dead, and porting it would be porting a no-op.

const trimmed = z.string().trim();
const optionalText = trimmed.optional().default('');

// `YYYY-MM-DD` from a native date input. Kept as a string (not coerced to Date) because the
// filters are calendar-day comparisons in the office's own reading of the date; the query
// builder decides the instant.
const dateOnly = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .optional()
  .or(z.literal(''))
  .transform((v) => v || '');

export const listParcelsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(500).default(25),
  // Only the four columns the legacy `ordering` switch accepts; anything else fell through
  // to its `TrackingNum` default rather than erroring.
  sort: z.enum(['Created', 'TripDate', 'TrackingNum', 'TrackingNum2']).catch('Created'),
  dir: z.enum(['asc', 'desc']).catch('desc'),

  // Main search form.
  search: optionalText,
  sender: optionalText,
  tripDate: dateOnly,
  receivedDate: dateOnly,
  service: optionalText,
  groupId: optionalText,
  city: z.enum(['', '1', '2']).catch(''),
  status: optionalText,
  statusDate: dateOnly,
  isPaid: z.enum(['', 'Y', 'N']).catch(''),
  debt: optionalText,
  userId: optionalText,

  // "Extra search" form: a milestone-timestamp range plus who received the parcel.
  extraStatus: optionalText,
  receivedBy: optionalText,
  // Opts out of the implicit "only parcels you received" scope an otherwise-unfiltered list
  // falls back to (see the list route). Legacy had no such escape hatch — the only way to see
  // everyone's parcels was to set some unrelated filter and wonder why.
  allReceivers: z.enum(['', '1']).catch(''),
  fromDate: dateOnly,
  fromHour: z.coerce.number().int().min(0).max(23).catch(0),
  fromMinute: z.coerce.number().int().min(0).max(59).catch(0),
  toDate: dateOnly,
  toHour: z.coerce.number().int().min(0).max(23).catch(0),
  toMinute: z.coerce.number().int().min(0).max(59).catch(0),

  // Legacy `url.delreq=1` / `url.del=1`: two mutually-exclusive "delivery request" slices of
  // the same screen, each adding its own where-clause (and, for `delreq`, a Buser column).
  deliveryRequest: z.enum(['', '1']).catch(''),
  deliveryPending: z.enum(['', '1']).catch(''),
});

export type ListParcelsQuery = z.infer<typeof listParcelsQuerySchema>;

export const parcelOperationSchema = z
  .object({
    operation: z.enum(PARCEL_OPERATIONS),
    parcelIds: z.array(z.uuid()).min(1, 'Select at least one parcel.'),
    // Absent means "now", matching `parcels-operation.cfm`'s `isDate()` fallback.
    operationDate: z.iso.datetime({ offset: true }).optional(),
    payMethod1: optionalText,
    pCode: optionalText,
    awb: optionalText,
    /** Delivery-Request mode only: the admin taking the parcels out for delivery. */
    buser: optionalText,
  })
  .refine((data) => data.operation !== 'paid' || data.payMethod1 !== '', {
    message: 'Select payment method',
    path: ['payMethod1'],
  })
  .refine((data) => data.operation !== 'awb' || data.awb !== '', {
    message: 'Set AWB code',
    path: ['awb'],
  })
  .refine((data) => data.operation !== 'change_code' || data.pCode !== '', {
    message: 'Set code',
    path: ['pCode'],
  });

export type ParcelOperationInput = z.infer<typeof parcelOperationSchema>;

// --- Parcel edit form ---------------------------------------------------------------------
//
// Ported from `extensions/components/validation/bema/ParcelUpdate.cfc` plus the two extra
// checks `bema/parcels/parcels-update.cfm` does inline (notes-required-when-weight-or-debt-
// changed, and the payment-method-required-when-marking-paid pair). Everything the legacy
// validator does *not* check is left permissive here too — this is the same form, not a
// stricter one.

const money = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === 'number' ? v : v.trim()))
  .refine((v) => v === '' || !Number.isNaN(Number(v)), 'Must be a number')
  .transform((v) => (v === '' ? null : Number(v)));

const requiredMoney = (label: string) => money.refine((v): v is number => v !== null, `${label} is required.`);

/** `datetime-local`/`date` input value, or empty for "not set". Stored as-is and interpreted
 *  as UTC by the service layer, matching how the list screen reads these back. */
const optionalDateTime = z
  .string()
  .trim()
  .refine((v) => v === '' || !Number.isNaN(Date.parse(v)), 'Invalid date')
  .optional()
  .default('');

const receiverSchema = z.object({
  /** Empty = "< New Receiver >": the address is created and attached to the customer. */
  receiverId: z.uuid().nullable().optional(),
  isGeCitizen: z.boolean().default(false),
  firstName: z.string().max(50).default(''),
  lastName: z.string().max(50).default(''),
  firstNameGe: z.string().max(50).default(''),
  lastNameGe: z.string().max(50).default(''),
  organization: z.string().max(100).default(''),
  country: z.string().default(''),
  street1: z.string().max(100).default(''),
  street2: z.string().max(100).default(''),
  city: z.string().max(50).default(''),
  state: z.string().max(50).default(''),
  postalCode: z.string().max(25).default(''),
  phone1: z.string().max(50).default(''),
  phone2: z.string().max(50).default(''),
  phone3: z.string().max(50).default(''),
});

/** The sender's own billing details, editable inline on the parcel form — legacy saves these
 *  back onto the customer record on every parcel save. */
const customerSchema = z.object({
  firstName: z.string().max(50).default(''),
  lastName: z.string().max(50).default(''),
  organization: z.string().max(100).default(''),
  country: z.string().default(''),
  street1: z.string().max(100).default(''),
  street2: z.string().max(100).default(''),
  city: z.string().max(50).default(''),
  state: z.string().max(50).default(''),
  postalCode: z.string().max(25).default(''),
  phone1: z.string().max(50).default(''),
  phone2: z.string().max(50).default(''),
});

export const updateParcelSchema = z
  .object({
    trackingNum: z.string().trim().min(1, 'Tracking # is required.').max(100),
    trackingNum2: z.string().trim().max(100).default(''),
    userId: z.uuid('Customer is required.'),
    tripDate: z.string().trim().min(1, 'Trip Date is required.'),
    service: z.string().trim().min(1, 'Service is required.'),
    awb: z.string().trim().max(150).default(''),
    contents: z.string().trim().default(''),
    store: z.string().trim().max(100).default(''),

    weight: requiredMoney('Weight'),
    value: requiredMoney('Value'),
    length: money.nullable().default(null),
    width: money.nullable().default(null),
    high: money.nullable().default(null),
    dimWeight: money.nullable().default(null),
    debt: money.nullable().default(null),

    location: z.string().trim().max(100).default(''),
    groupId: z.string().trim().max(12).default(''),
    notes: z.string().trim().default(''),
    /** Sent back untouched from the loaded parcel so the server can apply legacy's
     *  "changing weight or amount requires a note" rule without trusting the client's word
     *  for what the previous values were. */
    notesRequired: z.boolean().default(false),

    /** Chosen `delivery_offices` row, or empty to clear the assignment. */
    officeId: z.union([z.uuid(), z.literal('')]).default(''),

    receiver: receiverSchema,
    customer: customerSchema,

    // Payment. `markPaid`/`markUnpaid` run the same `paid`/`unpaid` operations the list
    // screen's bulk toolbar does — the legacy form calls straight into `doOperation()` too.
    markPaid: z.boolean().default(false),
    markUnpaid: z.boolean().default(false),
    payMethod1: z.string().default(''),
    payAmount2: money.nullable().default(null),
    payMethod2: z.string().default(''),

    trackingReceived: optionalDateTime,
    trackingReceivedBy: z.union([z.uuid(), z.literal('')]).default(''),
    trackingAway: optionalDateTime,
    trackingEstDelivery: optionalDateTime,
    trackingEstShip: optionalDateTime,
    trackingShipped: optionalDateTime,
    trackingDelay: optionalDateTime,
    trackingCustom: optionalDateTime,
    trackingProcessingCustom: optionalDateTime,
    trackingOffice: optionalDateTime,
    trackingSendRegion: optionalDateTime,
    trackingOutDelivery: optionalDateTime,
    trackingDeliveredSigned: optionalDateTime,
    trackingDeliveredSignedBy: z.union([z.uuid(), z.literal('')]).default(''),
  })
  // A Georgian citizen is identified by their Georgian-script name; everyone else by the
  // Latin one. Legacy requires whichever pair applies and ignores the other.
  .refine((d) => d.receiver.isGeCitizen || d.receiver.firstName !== '', {
    message: 'Receiver First Name is required.',
    path: ['receiver', 'firstName'],
  })
  .refine((d) => d.receiver.isGeCitizen || d.receiver.lastName !== '', {
    message: 'Receiver Last Name is required.',
    path: ['receiver', 'lastName'],
  })
  .refine((d) => !d.receiver.isGeCitizen || d.receiver.firstNameGe !== '', {
    message: 'Receiver First Name is required.',
    path: ['receiver', 'firstNameGe'],
  })
  .refine((d) => !d.receiver.isGeCitizen || d.receiver.lastNameGe !== '', {
    message: 'Receiver Last Name is required.',
    path: ['receiver', 'lastNameGe'],
  })
  .refine((d) => d.receiver.city !== '', {
    message: 'Receiver City is required.',
    path: ['receiver', 'city'],
  })
  .refine((d) => d.receiver.country !== '', {
    message: 'Receiver Country is required.',
    path: ['receiver', 'country'],
  })
  .refine((d) => d.receiver.phone1 !== '', {
    message: 'Receiver Phone (1) is required.',
    path: ['receiver', 'phone1'],
  })
  // State/postal code are only demanded for US addresses. (Legacy's comment records that
  // this used to be "everywhere except GE" and was narrowed to US in 2023.)
  .refine((d) => d.receiver.country !== 'US' || d.receiver.state !== '', {
    message: 'Receiver State is required.',
    path: ['receiver', 'state'],
  })
  .refine((d) => d.receiver.country !== 'US' || d.receiver.postalCode !== '', {
    message: 'Receiver Postal Code is required.',
    path: ['receiver', 'postalCode'],
  })
  .refine(
    (d) =>
      d.receiver.country !== 'US' || d.receiver.postalCode === '' || /^\d{5}(-\d{4})?$/.test(d.receiver.postalCode),
    {
      message: 'Receiver Postal Code is invalid.',
      path: ['receiver', 'postalCode'],
    },
  )
  // Legacy: an edit that changes the weight or the amount has to say why.
  .refine((d) => !d.notesRequired || d.notes !== '', {
    message: 'Notes is required when the weight or amount changes.',
    path: ['notes'],
  })
  .refine((d) => !d.markPaid || d.payMethod1 !== '', {
    message: 'Select payment method',
    path: ['payMethod1'],
  })
  .refine((d) => d.payAmount2 === null || d.payAmount2 <= 0 || d.payMethod2 !== '', {
    message: 'Select payment method for the partial payment',
    path: ['payMethod2'],
  });

/** Parsed shape, as the service layer receives it: money coerced to `number | null`, dates
 *  normalised, defaults filled in. */
export type UpdateParcelInput = z.infer<typeof updateParcelSchema>;

/** Unparsed shape, as the form sends it — money and dates are still the raw strings the
 *  inputs hold. The client is typed against this so it doesn't have to pre-coerce values the
 *  schema is about to coerce anyway. */
export type UpdateParcelPayload = z.input<typeof updateParcelSchema>;
