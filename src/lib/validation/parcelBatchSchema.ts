import { z } from 'zod';
import { customerSchema, money, receiverSchema, requiredMoney } from '@/lib/validation/parcelSchema';

// The batch "Add Parcel" screen (`bema/parcels/parcels-add.cfm` + `views/parcels/
// vwParcelsAdd.cfm`) — several draft parcels, each with its own receiver, created together
// for one customer in a single submit. Reuses `receiverSchema`/`customerSchema`/`money` from
// the single-parcel edit schema (same sub-shapes, same rules) rather than redefining them.

export const quickCustomerSchema = z.object({
  userId: z.uuid().nullable(),
  organization: z.string().max(100).default(''),
  firstName: z.string().trim().min(1, 'First name is required.').max(50),
  lastName: z.string().trim().min(1, 'Last name is required.').max(50),
  email: z.string().trim().email('A valid email is required.'),
  country: z.string().trim().min(1, 'Country is required.'),
  street1: z.string().max(100).default(''),
  street2: z.string().max(100).default(''),
  city: z.string().trim().min(1, 'City is required.').max(50),
  state: z.string().max(50).default(''),
  postalCode: z.string().max(25).default(''),
  phone1: z.string().trim().min(1, 'Cell phone is required.').max(50),
  phone2: z.string().max(50).default(''),
});

export type QuickCustomerPayload = z.input<typeof quickCustomerSchema>;

const draftParcelSchema = z.object({
  delivery: z.enum(['Pickup', 'Delivery', 'Region']),
  service: z.enum(['Regular', 'Express', 'Cargo']),
  contents: z.string().trim().default(''),
  trackingNum: z.string().trim().min(1, 'Tracking # is required.').max(100),
  weight: requiredMoney('Weight'),
  value: requiredMoney('Value'),
  groupId: z.string().trim().min(1).max(12).default('1'),
  notes: z.string().trim().default(''),
  officeId: z.union([z.uuid(), z.literal('')]).default(''),
  trackingReceived: z.string().trim().default(''),
  trackingReceivedBy: z.union([z.uuid(), z.literal('')]).default(''),
  notify: z.boolean().default(true),
  receiver: receiverSchema,
});

/** The same per-receiver requiredness rules `updateParcelSchema` enforces, applied to one
 *  array element here — kept as a standalone function (rather than sharing that schema's
 *  `.refine()` chain directly) so this new screen can't destabilise the already-shipped edit
 *  form's validation by restructuring it. */
function receiverIssues(receiver: z.infer<typeof receiverSchema>): { path: (string | number)[]; message: string }[] {
  const issues: { path: (string | number)[]; message: string }[] = [];
  const add = (path: (string | number)[], message: string) => issues.push({ path, message });

  if (!receiver.isGeCitizen && receiver.firstName === '') add(['firstName'], 'Receiver First Name is required.');
  if (!receiver.isGeCitizen && receiver.lastName === '') add(['lastName'], 'Receiver Last Name is required.');
  if (receiver.isGeCitizen && receiver.firstNameGe === '') add(['firstNameGe'], 'Receiver First Name is required.');
  if (receiver.isGeCitizen && receiver.lastNameGe === '') add(['lastNameGe'], 'Receiver Last Name is required.');
  if (receiver.city === '') add(['city'], 'Receiver City is required.');
  if (receiver.country === '') add(['country'], 'Receiver Country is required.');
  if (receiver.phone1 === '') add(['phone1'], 'Receiver Phone (1) is required.');
  if (receiver.country === 'US' && receiver.state === '') add(['state'], 'Receiver State is required.');
  if (receiver.country === 'US' && receiver.postalCode === '') add(['postalCode'], 'Receiver Postal Code is required.');
  if (receiver.country === 'US' && receiver.postalCode !== '' && !/^\d{5}(-\d{4})?$/.test(receiver.postalCode)) {
    add(['postalCode'], 'Receiver Postal Code is invalid.');
  }
  return issues;
}

export const addParcelBatchSchema = z
  .object({
    userId: z.uuid('Customer is required.'),
    customer: customerSchema,
    notifications: z.array(z.enum(['Mail', 'SMS'])).default([]),

    paymentMethod1: z.string().trim().min(1, 'Select payment method'),
    paymentAmount1: money.default(0),
    paymentMethod2: z.string().trim().default(''),
    paymentAmount2: money.default(0),
    /** Blank (the common case) or equal to the calculated total is a no-op; anything else
     *  scales every parcel's price proportionally — see `batchPricing.ts`. */
    priceTotal: money.default(null),

    draftParcels: z.array(draftParcelSchema).min(1, 'Add at least one parcel.'),
  })
  .refine((d) => d.paymentAmount2 === 0 || d.paymentMethod2 !== '', {
    message: 'Select payment method for the second payment',
    path: ['paymentMethod2'],
  })
  .superRefine((d, ctx) => {
    for (const [groupId, group] of Object.entries(groupBy(d.draftParcels, (p) => p.groupId))) {
      const [first, ...rest] = group;
      for (const other of rest) {
        if (other.item.delivery !== first.item.delivery || other.item.service !== first.item.service) {
          ctx.addIssue({
            code: 'custom',
            message: `Group ${groupId}: every parcel in a group must share the same delivery and service.`,
            path: ['draftParcels', other.index, 'groupId'],
          });
        }
      }
    }

    d.draftParcels.forEach((draft, index) => {
      for (const issue of receiverIssues(draft.receiver)) {
        ctx.addIssue({ code: 'custom', message: issue.message, path: ['draftParcels', index, 'receiver', ...issue.path] });
      }
    });
  });

function groupBy<T>(items: T[], key: (item: T) => string): Record<string, { item: T; index: number }[]> {
  const groups: Record<string, { item: T; index: number }[]> = {};
  items.forEach((item, index) => {
    (groups[key(item)] ??= []).push({ item, index });
  });
  return groups;
}

export type AddParcelBatchInput = z.infer<typeof addParcelBatchSchema>;
export type AddParcelBatchPayload = z.input<typeof addParcelBatchSchema>;
