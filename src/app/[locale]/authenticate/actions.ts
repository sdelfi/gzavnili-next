'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { CustomerAuthError, loginCustomer } from '@/lib/auth/customerLogin';
import { registerCustomer } from '@/lib/auth/customerRegister';
import { requestPasswordReset, resetPasswordWithToken, ResetTokenError } from '@/lib/auth/customerPasswordReset';
import {
  signAccessToken,
  signRefreshToken,
  REFRESH_TOKEN_TTL_SECONDS_SESSION,
  REFRESH_TOKEN_TTL_SECONDS_PERSISTENT,
} from '@/lib/auth/customerJwt';
import { setAuthCookies, clearAuthCookies } from '@/lib/auth/customerCookies';
import { loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema } from '@/lib/validation/authSchema';
import { routes } from '@/lib/routes';

export type ActionState = { error?: string; success?: string; fieldErrors?: Record<string, string[]> } | undefined;

async function clientMeta() {
  const h = await headers();
  return {
    ipAddress: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: h.get('user-agent'),
  };
}

function withLocale(path: string, locale: string) {
  return locale === 'ge' ? `/ge${path}` : path;
}

// Legacy `Authenticate.doPost`'s `ret` querystring param: where to send the visitor after a
// successful login (e.g. back to checkout) instead of always the account home. There's no
// `/account` dashboard built yet (see docs/decisions/0012-customer-auth.md), so the default
// is the home page rather than a page that doesn't exist.
export async function loginAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'Username and password are required.' };

  const locale = String(formData.get('locale') ?? 'en');
  const ret = formData.get('ret');

  try {
    const user = await loginCustomer({
      username: parsed.data.login_username,
      password: parsed.data.login_password,
      ...(await clientMeta()),
    });
    const persistent = parsed.data.remember_me === 'true';
    const payload = { sub: user.id };
    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken(payload),
      signRefreshToken(payload, persistent ? REFRESH_TOKEN_TTL_SECONDS_PERSISTENT : REFRESH_TOKEN_TTL_SECONDS_SESSION),
    ]);
    await setAuthCookies({ accessToken, refreshToken }, persistent);
  } catch (err) {
    if (err instanceof CustomerAuthError) return { error: err.message };
    throw err;
  }

  redirect(typeof ret === 'string' && ret ? ret : withLocale('/', locale));
}

export async function logoutAction(locale: string) {
  await clearAuthCookies();
  redirect(withLocale('/', locale));
}

export async function registerAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: 'Please fix the errors below.', fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const locale = String(formData.get('locale') ?? 'en');

  try {
    await registerCustomer({
      firstName: parsed.data.register_firstname,
      lastName: parsed.data.register_lastname,
      email: parsed.data.register_emailaddress,
      cellPhone: parsed.data.phone,
      country: parsed.data.country,
      city: parsed.data.city,
      state: parsed.data.state || null,
      postalCode: parsed.data.postalcode || null,
      street1: parsed.data.address,
      privateNumber: parsed.data.register_privatenumber || null,
      password: parsed.data.register_password,
      language: parsed.data.language ?? 'en',
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Registration failed.' };
  }

  redirect(`${withLocale(routes.login(), locale)}?registered=1`);
}

export async function forgotPasswordAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'Please enter a valid email address.' };

  const h = await headers();
  const origin = h.get('origin') ?? `https://${h.get('host')}`;
  const locale = String(formData.get('locale') ?? 'en');
  const resetLinkBase = `${origin}${withLocale('/authenticate/reset', locale)}`;

  await requestPasswordReset(parsed.data.forgot_username, resetLinkBase);

  // Deliberately the same success message regardless of whether the email matched an
  // account — see requestPasswordReset's comment on not confirming/denying existence.
  return { success: 'If that email is registered, a reset link has been sent.' };
}

export async function resetPasswordAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please fix the errors below.' };
  }
  const locale = String(formData.get('locale') ?? 'en');

  try {
    await resetPasswordWithToken(parsed.data.token, parsed.data.reset_password);
  } catch (err) {
    if (err instanceof ResetTokenError) return { error: err.message };
    throw err;
  }

  redirect(`${withLocale(routes.login(), locale)}?reset=1`);
}
