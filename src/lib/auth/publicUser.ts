import type { User } from '@/generated/prisma/client';

// Strips auth-sensitive fields before a user record is ever sent to the client — used by
// every bema API route that returns a `User` row (login, /me, users list/detail).
export function publicUser(user: User) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructure-to-omit
  const { passwordHash, passwordAlgo, passwordResetToken, ...rest } = user;
  return rest;
}
