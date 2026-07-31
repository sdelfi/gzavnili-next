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
