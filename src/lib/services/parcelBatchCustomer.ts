import { db } from '@/lib/db';
import { generateNextUsername } from '@/lib/auth/customerRegister';
import { PHONE1, PHONE2 } from '@/lib/services/parcelQuery';
import { orNull } from '@/lib/services/parcelShared';

// The batch "Add Parcel" screen's customer box, ported from `bema/ajax/customerEdit.cfm` —
// a lighter-weight create/update than the full "New Customer" form
// (`createUserSchema`/`updateUserSchema`), because that's what legacy actually offers here:
// no username or password field on this screen at all. A new customer gets an
// auto-generated username (`GZ<n>`, same generator the public registration flow uses) and no
// password hash — exactly legacy's outcome (a walk-in counter sign-up that can only ever log
// in after a "forgot password" reset, since nothing here ever sets one). An existing
// customer (picked via search) just gets its name/email/billing address refreshed.

export type QuickCustomerInput = {
  userId: string | null;
  organization: string;
  firstName: string;
  lastName: string;
  email: string;
  country: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  postalCode: string;
  phone1: string;
  phone2: string;
};

export async function saveQuickCustomer(input: QuickCustomerInput): Promise<{ id: string }> {
  const addressData = {
    organization: orNull(input.organization),
    email: orNull(input.email),
    firstName: orNull(input.firstName),
    lastName: orNull(input.lastName),
    country: orNull(input.country),
    street1: orNull(input.street1),
    street2: orNull(input.street2),
    city: orNull(input.city),
    state: orNull(input.state),
    postalCode: orNull(input.postalCode),
    [PHONE1]: orNull(input.phone1),
    [PHONE2]: orNull(input.phone2),
  };

  return db.$transaction(async (tx) => {
    let userId = input.userId;

    if (!userId) {
      const existing = await tx.user.findUnique({ where: { email: input.email }, select: { id: true } });
      if (existing) throw new Error('An account with this email already exists.');

      const username = await generateNextUsername();
      const created = await tx.user.create({
        data: {
          username,
          email: input.email,
          firstName: orNull(input.firstName),
          lastName: orNull(input.lastName),
          accountType: 'Customer',
          active: true,
          confirmed: true,
        },
      });
      userId = created.id;
    } else {
      await tx.user.update({
        where: { id: userId },
        data: { email: input.email, firstName: orNull(input.firstName), lastName: orNull(input.lastName) },
      });
    }

    const user = await tx.user.findUnique({ where: { id: userId }, select: { billingAddressId: true } });
    const billingAddressId = user?.billingAddressId
      ? (await tx.address.update({ where: { id: user.billingAddressId }, data: addressData })).id
      : (await tx.address.create({ data: addressData })).id;
    await tx.user.update({ where: { id: userId }, data: { billingAddressId } });

    return { id: userId };
  });
}
