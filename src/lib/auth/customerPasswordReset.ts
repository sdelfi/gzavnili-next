import { randomUUID } from 'node:crypto';
import { db } from '@/lib/db';
import { sendEmail } from '@/lib/email/sendEmail';
import { hashPassword } from './password';

// 60-minute expiry, matching the legacy `generateResetToken`'s `DateAdd('n', 60, Now())` —
// reuses the `User.passwordResetToken`/`passwordResetExpiresAt` columns already in the
// schema (added for the bema admin's password-reset support), same fields, same meaning.
const RESET_TOKEN_TTL_MINUTES = 60;

export async function requestPasswordReset(email: string, resetLinkBase: string) {
  const user = await db.user.findFirst({ where: { accountType: 'Customer', email } });
  // Deliberately no "email not found" error surfaced to the caller — matches the legacy
  // behavior of not confirming/denying account existence via this form's response.
  if (!user) return;

  const token = randomUUID();
  await db.user.update({
    where: { id: user.id },
    data: { passwordResetToken: token, passwordResetExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000) },
  });

  await sendEmail({
    to: user.email,
    subject: 'Forgot Password. Gzavnili.com',
    html: `<p>Hello ${user.firstName ?? user.username},</p><p>Reset your password: <a href="${resetLinkBase}?token=${token}">${resetLinkBase}?token=${token}</a></p><p>This link expires in ${RESET_TOKEN_TTL_MINUTES} minutes.</p>`,
  });
}

export class ResetTokenError extends Error {}

export async function resetPasswordWithToken(token: string, newPassword: string) {
  const user = await db.user.findFirst({ where: { passwordResetToken: token } });
  if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
    throw new ResetTokenError('This password reset link is invalid or has expired.');
  }

  const { hash, algo } = await hashPassword(newPassword);
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: hash, passwordAlgo: algo, passwordResetToken: null, passwordResetExpiresAt: null },
  });
}
