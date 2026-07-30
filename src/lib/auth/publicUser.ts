import type { User, Address } from '@/generated/prisma/client';

type UserWithRelations = User & {
  billingAddress?: Address | null;
  shippingAddress?: Address | null;
  notificationMessageTypes?: { key: string }[];
};

// Strips auth-sensitive fields before a user record is ever sent to the client — used by
// every bema API route that returns a `User` row (login, /me, users list/detail). Also
// flattens the notification-preference join rows into a plain `key[]` the UserForm can
// bind checkboxes to directly.
export function publicUser(user: UserWithRelations) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructure-to-omit
  const { passwordHash, passwordAlgo, passwordResetToken, notificationMessageTypes, ...rest } = user;
  return {
    ...rest,
    ...(notificationMessageTypes ? { notificationMessageTypeKeys: notificationMessageTypes.map((m) => m.key) } : {}),
  };
}
