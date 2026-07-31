import { db } from '@/lib/db';
import { upsertAddress } from '@/lib/services/userAddress';
import { hashPassword } from './password';

// Legacy `getNewUsername()` (MSSQLUserDAO.cfc): usernames auto-generated as `GZ` + an
// incrementing number, never chosen by the customer — ported verbatim rather than asking
// for a username on the register form (the form doesn't have one either, matching legacy).
export async function generateNextUsername() {
  const candidates = await db.user.findMany({
    where: { username: { startsWith: 'GZ' } },
    select: { username: true },
  });
  let max = 0;
  for (const { username } of candidates) {
    if (username.length >= 10) continue;
    const n = Number.parseInt(username.replace(/[^0-9]/g, ''), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `GZ${max + 1}`;
}

// Legacy conditionally requires email verification before activating the account
// (`application.requireEmailVerificationOnRegistration`) — deliberately skipped here since
// there's no transactional-email confirmation flow built for it yet (only the
// forgot-password reset link, which reuses the existing `sendEmail` utility). New accounts
// are `active`/`confirmed` immediately, matching legacy's *other* branch
// (`newUserActive = !application.requireEmailVerificationOnRegistration`). Flagged in
// docs/decisions/0012-customer-auth.md, not a silent gap.
export async function registerCustomer(input: {
  firstName: string;
  lastName: string;
  email: string;
  cellPhone: string;
  country: string;
  city: string;
  state: string | null;
  postalCode: string | null;
  street1: string;
  privateNumber: string | null;
  password: string;
  language: 'en' | 'ge';
}) {
  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new Error('An account with this email already exists.');
  }

  const username = await generateNextUsername();
  const { hash, algo } = await hashPassword(input.password);

  return db.$transaction(async (tx) => {
    const billingAddressId = await upsertAddress(tx, null, {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      country: input.country,
      city: input.city,
      state: input.state,
      postalCode: input.postalCode,
      street1: input.street1,
      cellPhone: input.cellPhone,
      privateNumber: input.privateNumber,
    });
    return tx.user.create({
      data: {
        username,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        passwordHash: hash,
        passwordAlgo: algo,
        accountType: 'Customer',
        active: true,
        confirmed: true,
        language: input.language,
        billingAddressId,
      },
    });
  });
}
