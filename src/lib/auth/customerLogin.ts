import { db } from '@/lib/db';
import { verifyPassword } from './password';

// Same thresholds/table as the bema realm's login.ts — legacy's `validateLogin` is one DAO
// method shared by both bema and customer accounts, with identical lockout behavior for
// either (see extensions/components/DAO/MSSQL/MSSQLUserDAO.cfc), so there's no reason for
// this realm's policy to differ.
const MAX_FAILED_ATTEMPTS = 15;
const LOCKOUT_MINUTES = 15;

export class CustomerAuthError extends Error {
  constructor(
    message: string,
    public code: 'invalid_credentials' | 'account_inactive' | 'account_not_confirmed' | 'locked_out',
  ) {
    super(message);
  }
}

export async function loginCustomer(input: {
  username: string;
  password: string;
  ipAddress: string | null;
  userAgent: string | null;
}) {
  const user = await db.user.findFirst({
    where: {
      accountType: 'Customer',
      OR: [{ username: input.username }, { email: input.username }],
    },
  });

  const logAttempt = (type: 'Success' | 'Failure') =>
    db.securityLog.create({
      data: { type, event: 'Login', username: input.username, ipAddress: input.ipAddress, userAgent: input.userAgent },
    });

  if (!user) {
    await logAttempt('Failure');
    throw new CustomerAuthError('Invalid username or password.', 'invalid_credentials');
  }
  if (user.lockoutEnabled && user.lockoutExpiresAt && user.lockoutExpiresAt > new Date()) {
    await logAttempt('Failure');
    throw new CustomerAuthError('This account is locked. Please wait a bit and try again.', 'locked_out');
  }
  if (!user.active) {
    await logAttempt('Failure');
    throw new CustomerAuthError('This account is not active.', 'account_inactive');
  }
  if (!user.confirmed) {
    await logAttempt('Failure');
    throw new CustomerAuthError('This account is not yet confirmed.', 'account_not_confirmed');
  }

  const passwordOk = user.passwordHash && (await verifyPassword(input.password, user.passwordHash, user.passwordAlgo));
  if (!passwordOk) {
    await logAttempt('Failure');
    const since = user.lastLoginAt ?? new Date(0);
    const failedCount = await db.securityLog.count({
      where: { username: input.username, type: 'Failure', event: 'Login', createdAt: { gt: since } },
    });
    if (failedCount >= MAX_FAILED_ATTEMPTS) {
      await db.user.update({
        where: { id: user.id },
        data: { lockoutEnabled: true, lockoutExpiresAt: new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) },
      });
    }
    throw new CustomerAuthError('Invalid username or password.', 'invalid_credentials');
  }

  await logAttempt('Success');
  return db.user.update({
    where: { id: user.id },
    data: { lockoutEnabled: false, lockoutExpiresAt: null, lastLoginAt: new Date() },
  });
}
