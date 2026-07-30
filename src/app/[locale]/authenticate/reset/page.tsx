import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';
import { routes } from '@/lib/routes';

export const metadata: Metadata = {
  title: 'Reset Password - Gzavnili',
  description: 'Choose a new password for your Gzavnili account.',
};

// Landing page for the link `requestPasswordReset` emails (`/authenticate/reset?token=...`,
// legacy: `/authenticate/reset/?token=...`). Token validity (existence + 60-minute expiry)
// is checked again server-side in `resetPasswordAction` on submit — this page doesn't need
// to pre-validate it, a missing token just means the form will fail on submit with the same
// "invalid or expired" message.
export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  const { token } = await searchParams;
  if (!token) redirect(routes.forgotPassword());

  return (
    <section className="accountreg">
      <div className="container loginpage">
        <h1>Reset Password</h1>
        <ResetPasswordForm locale={locale} token={token} />
      </div>
    </section>
  );
}
