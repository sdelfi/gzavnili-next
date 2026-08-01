import { z } from 'zod';

// bema "Add Online Parcel" (`bema/parcels/parcels-online-add-2.cfm`). Legacy's own
// `ValidationBean` here is created but never actually validated against
// (`vo.getResult()` is never checked before saving) — the only real requiredness is the
// weight field's HTML5 `required min="0.2" max="500"` and the "you need to fill customer
// field" client-side alert for the Known-Shipper tab. Reproduced permissively, matching
// that near-absence of server-side validation, not tightened. See
// docs/decisions/0022-parcels-online-add.md.

const optionalText = z.string().trim().default('');
const service = z.enum(['Regular', 'Express', 'Cargo']);
const weight = z.coerce.number().min(0.2).max(500);
const dimension = z.coerce.number().min(0).default(0);
const money = z.coerce.number().min(0).default(0);

const receiverSchema = z.object({
  receiverId: z.union([z.uuid(), z.literal('')]).default(''),
  firstName: optionalText,
  lastName: optionalText,
  organization: optionalText,
  city: optionalText,
  state: optionalText,
  street1: optionalText,
  street2: optionalText,
  phone1: optionalText,
  phone2: optionalText,
  phone3: optionalText,
});

const commonFields = {
  trackingNum: z.string().trim().min(1, 'Tracking Number is required.').max(100),
  trackingNum2: optionalText,
  service,
  weight,
  debt: money,
  length: dimension,
  width: dimension,
  high: dimension,
  dimWeight: dimension,
  notes: optionalText,
  trackingReceivedBy: z.union([z.uuid(), z.literal('')]).default(''),
};

export const updateOnlineParcelSchema = z.object(commonFields);
export type UpdateOnlineParcelPayload = z.infer<typeof updateOnlineParcelSchema>;

export const createOnlineParcelSchema = z
  .object({
    ...commonFields,
    parcelName: optionalText,
    notOnHold: z.boolean().default(false),
    tab: z.enum(['known', 'unknown', 'linoli']),
    userId: z.union([z.uuid(), z.literal('')]).default(''),
    notify: z.boolean().default(false),
    receiver: receiverSchema.optional(),
    unknownFirstName: optionalText,
    unknownLastName: optionalText,
    linoliFirstName: optionalText,
    linoliLastName: optionalText,
    linoliUsername: optionalText,
  })
  .refine((data) => data.tab !== 'known' || data.userId !== '', {
    message: 'You need to fill customer field',
    path: ['userId'],
  });
export type CreateOnlineParcelPayload = z.infer<typeof createOnlineParcelSchema>;
