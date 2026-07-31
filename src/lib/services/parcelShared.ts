import type { Prisma } from '@/generated/prisma/client';
import { PHONE1, PHONE2, PHONE3 } from '@/lib/services/parcelQuery';

// Receiver/customer upsert logic shared by the parcel edit save (`parcelUpdate.ts`) and the
// batch "Add Parcel" save (`parcelBatchAdd.ts`) — both write a receiver's address the same
// way, and both write the sender's own name/billing address the same way. Split out so the
// batch save (one customer, several parcels, each potentially a *different* receiver) isn't
// a copy-paste of the single-parcel save.

type Tx = Prisma.TransactionClient;

/** Empty string means "not set" throughout these forms; the DB wants NULL. */
export const orNull = (value: string) => (value.trim() === '' ? null : value.trim());

export type ReceiverFields = {
  receiverId?: string | null;
  isGeCitizen: boolean;
  firstName: string;
  lastName: string;
  firstNameGe: string;
  lastNameGe: string;
  organization: string;
  country: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  postalCode: string;
  phone1: string;
  phone2: string;
  phone3: string;
};

/** Creates or updates a receiver's address in place, and returns the receiver id that ends up
 *  attached to the parcel. A given `receiverId` that no longer exists (deleted between
 *  loading the form and saving it) falls back to creating a fresh receiver rather than
 *  writing an orphaned address — legacy would have written the orphan. */
export async function upsertReceiver(tx: Tx, userId: string, fields: ReceiverFields): Promise<string> {
  const addressData: Prisma.AddressUncheckedCreateInput = {
    firstName: orNull(fields.firstName),
    lastName: orNull(fields.lastName),
    firstNameGe: orNull(fields.firstNameGe),
    lastNameGe: orNull(fields.lastNameGe),
    organization: orNull(fields.organization),
    country: orNull(fields.country),
    street1: orNull(fields.street1),
    street2: orNull(fields.street2),
    city: orNull(fields.city),
    state: orNull(fields.state),
    postalCode: orNull(fields.postalCode),
    [PHONE1]: orNull(fields.phone1),
    [PHONE2]: orNull(fields.phone2),
    [PHONE3]: orNull(fields.phone3),
  };

  let receiverId = fields.receiverId ?? null;
  if (receiverId) {
    const existing = await tx.receiver.findUnique({ where: { id: receiverId }, select: { addressId: true } });
    if (existing) {
      await tx.address.update({ where: { id: existing.addressId }, data: addressData });
      await tx.receiver.update({ where: { id: receiverId }, data: { isGeCitizen: fields.isGeCitizen } });
      return receiverId;
    }
    receiverId = null;
  }

  const address = await tx.address.create({ data: addressData });
  const created = await tx.receiver.create({
    data: { userId, addressId: address.id, isGeCitizen: fields.isGeCitizen },
  });
  return created.id;
}

export type CustomerFields = {
  firstName: string;
  lastName: string;
  organization: string;
  country: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  postalCode: string;
  phone1: string;
  phone2: string;
};

/** Updates the customer's own name and billing address — legacy does this on every parcel
 *  save (including the batch add), which is why a typo on a parcel form is the normal way a
 *  customer's account address gets fixed. No-ops if the user id doesn't resolve to a real
 *  customer (shouldn't happen once the form requires picking/creating one, but the edit
 *  screen's existing behaviour is preserved here rather than tightened). */
export async function upsertCustomer(tx: Tx, userId: string, fields: CustomerFields): Promise<void> {
  const customer = await tx.user.findUnique({ where: { id: userId }, select: { billingAddressId: true } });
  if (!customer) return;

  const addressData: Prisma.AddressUncheckedCreateInput = {
    firstName: orNull(fields.firstName),
    lastName: orNull(fields.lastName),
    organization: orNull(fields.organization),
    country: orNull(fields.country),
    street1: orNull(fields.street1),
    street2: orNull(fields.street2),
    city: orNull(fields.city),
    state: orNull(fields.state),
    postalCode: orNull(fields.postalCode),
    [PHONE1]: orNull(fields.phone1),
    [PHONE2]: orNull(fields.phone2),
  };

  const billingAddressId = customer.billingAddressId
    ? (await tx.address.update({ where: { id: customer.billingAddressId }, data: addressData })).id
    : (await tx.address.create({ data: addressData })).id;

  await tx.user.update({
    where: { id: userId },
    data: { firstName: orNull(fields.firstName), lastName: orNull(fields.lastName), billingAddressId },
  });
}
