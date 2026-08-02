import { z } from 'zod';

// bema "Georgian Offices" (`bema/config/offices.cfm` + `office_edit.cfm`) — see
// docs/decisions/0030-georgian-offices.md. `searchPatterns` has no field of its own here:
// legacy's own edit form has that input commented out, so it's never actually submitted —
// see the decision doc for what that does to every save.
export const deliveryOfficeSchema = z.object({
  city: z.string().min(1, 'City is required.').max(50),
  officeName: z.string().min(1, 'Office Name is required.').max(50),
  officeNameGe: z.string().max(50).nullable().optional(),
  letter: z.string().min(1, 'Letter is required.').max(50),
  active: z.boolean(),
});

export const listDeliveryOfficesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(500).default(25),
  search: z.string().optional(),
  // Legacy's own `url.active` default is `"1"` (Active only) — the list starts filtered,
  // not showing everything, until an operator explicitly picks "" (any status).
  active: z.union([z.enum(['0', '1']), z.literal('')]).default('1'),
  sort: z.enum(['city', 'officeName', 'officeNameGe', 'letter', 'active']).default('city'),
  dir: z.enum(['asc', 'desc']).default('asc'),
});
