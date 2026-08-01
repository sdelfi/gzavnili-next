import { z } from 'zod';

// Legacy's hard-coded `<option value="998">Set empty</option>` — distinct from `999` ("Need
// delivery"), which is now a real seeded `DeliveryOffice` row and needs no special-casing
// (`/api/bema/delivery-offices` already returns it like any other office). Defined here
// (not in the service module, which pulls in the server-only Prisma client) so this client
// component's own import stays server-code-free.
export const CLEAR_OFFICE = '__clear__';

// bema "Change Parcel status". The only options this screen's own `<select name="operation">`
// actually offers — a subset of the full `PARCEL_OPERATIONS` list (no delete/unpaid/
// change_code/awb/estdelivery, none of which this screen's dropdown has an option for).
export const CHANGE_STATUS_OPERATIONS = [
  '',
  'delivered',
  'office',
  'processingCustom',
  'custom',
  'outdelivery',
  'delay',
  'received',
  'awaiting',
  'region',
  'shipped',
  'paid',
] as const;

export const changeParcelStatusSchema = z.object({
  operation: z.enum(CHANGE_STATUS_OPERATIONS).default(''),
  officeId: z.union([z.uuid(), z.literal(CLEAR_OFFICE), z.literal('')]).default(''),
  buser: z.union([z.uuid(), z.literal('')]).default(''),
  iLocation: z.string().trim().default(''),
});
export type ChangeParcelStatusPayload = z.infer<typeof changeParcelStatusSchema>;
