import type { Prisma } from '@/generated/prisma/client';

export const USER_DETAIL_INCLUDE = {
  billingAddress: true,
  shippingAddress: true,
  notificationMessageTypes: { select: { key: true } },
} satisfies Prisma.UserInclude;

export type AddressInput = Prisma.AddressCreateInput;

// Shared by create/update: an address sub-object with no fields set at all (every value
// undefined/null) is treated as "no address to save", not an empty row — this is what lets
// the user form omit billing/shipping entirely instead of always creating a blank Address.
export function hasAnyAddressField(data: Partial<AddressInput> | null | undefined): boolean {
  if (!data) return false;
  return Object.values(data).some((v) => v !== null && v !== undefined && v !== '');
}

// Creates a new Address row (returning its id) if `existingId` is null, otherwise updates
// the existing row in place — matches the legacy `saveBillingDefault`/`saveShippingDefault`
// "there's always at most one address per slot" behavior, not an address history.
export async function upsertAddress(
  tx: Prisma.TransactionClient,
  existingId: string | null | undefined,
  data: Partial<AddressInput> | null | undefined,
): Promise<string | null> {
  if (!hasAnyAddressField(data)) return existingId ?? null;
  if (existingId) {
    await tx.address.update({ where: { id: existingId }, data: data! });
    return existingId;
  }
  const created = await tx.address.create({ data: data! });
  return created.id;
}
