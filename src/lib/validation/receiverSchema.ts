import { z } from 'zod';

// Mirrors legacy extensions/components/validation/bema/ReceiverUpdate.cfc — the standalone
// Receivers admin screen's validation. Deliberately stricter than (and separate from) the
// simplified inline rules the parcel form already uses for its own receiver picker/upsert
// (see ParcelDraftModal.tsx's `validate()` and PROGRESS.md's note on that being a documented
// simplification) — that form is left untouched, this schema only governs the dedicated
// Receivers screen this file backs.
const requiresStateAndPostal = (country: string) => country.trim().toUpperCase() !== 'GE';

const baseShape = {
  userId: z.string().min(1, 'Customer is required.'),
  isGeCitizen: z.boolean().optional(),
  firstName: z.string().min(1, 'First Name is required.').max(50),
  lastName: z.string().min(1, 'Last Name is required.').max(50),
  firstNameGe: z.string().max(50).optional().or(z.literal('')),
  lastNameGe: z.string().max(50).optional().or(z.literal('')),
  organization: z.string().max(100).optional().or(z.literal('')),
  // Legacy validates against a fixed known-country list; not reproduced here (no such list
  // exists in this codebase yet — see ParcelReceiverSection's own 2-letter free-text Country
  // field, which this mirrors instead of inventing a new lookup).
  country: z.string().min(1, 'Country is required.').max(2),
  street1: z.string().max(100).optional().or(z.literal('')),
  street2: z.string().max(100).optional().or(z.literal('')),
  city: z.string().min(1, 'City is required.').max(50),
  state: z.string().max(50).optional().or(z.literal('')),
  postalCode: z.string().max(20).optional().or(z.literal('')),
  phone1: z.string().min(1, 'Phone is required.').max(50),
  phone2: z.string().max(50).optional().or(z.literal('')),
  phone3: z.string().max(50).optional().or(z.literal('')),
  active: z.boolean().optional(),
};

export const receiverSchema = z
  .object(baseShape)
  .refine((data) => !requiresStateAndPostal(data.country) || !!data.state?.trim(), {
    message: 'State is required.',
    path: ['state'],
  })
  .refine((data) => !requiresStateAndPostal(data.country) || !!data.postalCode?.trim(), {
    message: 'Postal Code is required.',
    path: ['postalCode'],
  });

export const listReceiversQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(500).default(25),
  search: z.string().optional(),
  userId: z.string().optional(),
  // Legacy `receivers.cfm` defaults `status=1` (active only) on first load; the list screen
  // sets this explicitly rather than relying on a schema default so "All" can send `''`.
  active: z.enum(['true', 'false']).optional(),
  sort: z.enum(['lastName', 'firstName']).default('lastName'),
  dir: z.enum(['asc', 'desc']).default('asc'),
});
