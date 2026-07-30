import { z } from 'zod';

// Mirrors extensions/components/validation/bema/UserEdit.cfc's rules from the legacy app
// (username/email/password constraints), extended to cover the full legacy "Edit
// Customer"/"Edit BEMA User" field set (see docs/decisions/0011-bema-admin.md's update on
// full-parity fields) — account info, notification prefs, billing/shipping address.
//
// Address requiredness (e.g. legacy's country-conditional State/PostalCode rule) is
// deliberately NOT fully replicated here — every address field is optional/lenient. This
// is a documented simplification, not an oversight: the fields all exist and round-trip
// correctly, but the exact legacy required/optional-per-country matrix isn't enforced yet.
const addressSchema = z.object({
  firstName: z.string().max(50).nullable().optional(),
  lastName: z.string().max(50).nullable().optional(),
  title: z.string().max(50).nullable().optional(),
  organization: z.string().max(100).nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal('')),
  country: z.string().max(100).nullable().optional(),
  street1: z.string().max(100).nullable().optional(),
  street2: z.string().max(100).nullable().optional(),
  city: z.string().max(50).nullable().optional(),
  state: z.string().max(50).nullable().optional(),
  postalCode: z.string().max(20).nullable().optional(),
  privateNumber: z.string().max(30).nullable().optional(),
  cellPhone: z.string().max(30).nullable().optional(),
  workPhone: z.string().max(30).nullable().optional(),
  homePhone: z.string().max(30).nullable().optional(),
  fax: z.string().max(30).nullable().optional(),
});

const baseFields = {
  username: z.string().min(5).max(50),
  email: z.string().email().max(100),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  accountType: z.enum(['Customer', 'BemaUser']),
  adminRole: z.enum(['BemaStandard', 'BemaAdministrator', 'BemaAgent']).nullable().optional(),
  active: z.boolean().optional(),
  confirmed: z.boolean().optional(),
  suffix: z.string().max(50).nullable().optional(),
  agentPrice: z.boolean().nullable().optional(),
  language: z.enum(['en', 'ge']).nullable().optional(),
  importId: z.string().max(100).nullable().optional(),
  balanceAdjust: z.number().optional(),
  notifyViaMail: z.boolean().optional(),
  notifyViaSms: z.boolean().optional(),
  notificationMessageTypeKeys: z.array(z.string()).optional(),
  billingAddress: addressSchema.nullable().optional(),
  shippingAddress: addressSchema.nullable().optional(),
};

function passwordDoesNotContainUsername(data: { username: string; password?: string }) {
  return !data.password || !data.password.toLowerCase().includes(data.username.toLowerCase());
}

export const createUserSchema = z
  .object({
    ...baseFields,
    password: z.string().min(8),
    // Legacy "short password"/PIN — optional, but if set must be >2 chars, matching the
    // legacy `validatePasswordShort`'s `len(PasswordShort) > 2` lookup guard.
    passwordShort: z.string().min(3).max(15).nullable().optional().or(z.literal('')),
  })
  .refine(passwordDoesNotContainUsername, { message: 'Password must not contain the username.', path: ['password'] })
  .refine((data) => data.accountType !== 'BemaUser' || !!data.adminRole, {
    message: 'A role is required for BEMA accounts.',
    path: ['adminRole'],
  });

export const updateUserSchema = z
  .object({
    ...baseFields,
    password: z.string().min(8).optional(),
    passwordShort: z.string().min(3).max(15).nullable().optional().or(z.literal('')),
  })
  .partial()
  .refine(
    (data) =>
      !data.password ||
      !data.username ||
      passwordDoesNotContainUsername({ username: data.username, password: data.password }),
    { message: 'Password must not contain the username.', path: ['password'] },
  )
  .refine((data) => data.accountType !== 'BemaUser' || data.adminRole !== null, {
    message: 'A role is required for BEMA accounts.',
    path: ['adminRole'],
  });

export const listUsersQuerySchema = z.object({
  accountType: z.enum(['Customer', 'BemaUser']).default('BemaUser'),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(500).default(25),
  search: z.string().optional(),
  active: z.enum(['true', 'false']).optional(),
  sort: z.enum(['lastName', 'username', 'email', 'createdAt']).default('lastName'),
  dir: z.enum(['asc', 'desc']).default('asc'),
});

export const pricingRuleSchema = z.object({
  serviceType: z.enum(['Regular', 'Express']),
  mode: z.enum(['FixedPrice', 'Discount']),
  value: z.number().positive(),
  validFrom: z.string().min(1),
  validTo: z.string().nullable().optional(),
  notes: z.string().max(255).nullable().optional(),
});
