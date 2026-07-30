import { z } from 'zod';

// Mirrors extensions/components/validation/bema/UserEdit.cfc's rules from the legacy app
// (username/email/password constraints). Address (billing/shipping) fields are
// deliberately out of scope for this pass — see PROGRESS.md.
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
};

function passwordDoesNotContainUsername(data: { username: string; password?: string }) {
  return !data.password || !data.password.toLowerCase().includes(data.username.toLowerCase());
}

export const createUserSchema = z
  .object({
    ...baseFields,
    password: z.string().min(8),
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
