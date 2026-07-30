import { db } from '@/lib/db';
import { verifyPassword } from './password';

// Thresholds match the legacy `MSSQLUserDAO.validateLogin` behavior (see the
// legacy-research notes this schema is based on): 15 failed attempts (counted since the
// account's last successful login) locks the account for 15 minutes.
const MAX_FAILED_ATTEMPTS = 15;
const LOCKOUT_MINUTES = 15;

export class AuthError extends Error {
  constructor(
    message: string,
    public code: 'invalid_credentials' | 'account_inactive' | 'account_not_confirmed' | 'locked_out' | 'not_admin',
  ) {
    super(message);
  }
}

export async function loginBemaUser(input: {
  username: string;
  password: string;
  ipAddress: string | null;
  userAgent: string | null;
}) {
  const user = await db.user.findFirst({
    where: {
      accountType: 'BemaUser',
      OR: [{ username: input.username }, { email: input.username }],
    },
  });

  const logAttempt = (type: 'Success' | 'Failure') =>
    db.securityLog.create({
      data: {
        type,
        event: 'Login',
        username: input.username,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });

  if (!user) {
    await logAttempt('Failure');
    throw new AuthError('Invalid username or password.', 'invalid_credentials');
  }

  if (user.lockoutEnabled && user.lockoutExpiresAt && user.lockoutExpiresAt > new Date()) {
    await logAttempt('Failure');
    throw new AuthError('This account is locked. Please wait a bit and try again.', 'locked_out');
  }

  if (!user.active) {
    await logAttempt('Failure');
    throw new AuthError('This account is not active.', 'account_inactive');
  }
  if (!user.confirmed) {
    await logAttempt('Failure');
    throw new AuthError('This account is not yet confirmed.', 'account_not_confirmed');
  }
  if (!user.adminRole) {
    await logAttempt('Failure');
    throw new AuthError('This account does not have admin access.', 'not_admin');
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
        data: {
          lockoutEnabled: true,
          lockoutExpiresAt: new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000),
        },
      });
    }
    throw new AuthError('Invalid username or password.', 'invalid_credentials');
  }

  await logAttempt('Success');
  const updated = await db.user.update({
    where: { id: user.id },
    data: { lockoutEnabled: false, lockoutExpiresAt: null, lastLoginAt: new Date() },
  });

  return updated;
}
