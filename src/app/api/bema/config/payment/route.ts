import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';
import { paymentConfigSchema } from '@/lib/validation/paymentConfigSchema';

// Bema "Payment Preferences" (legacy `bema/config/payment.cfm`) — same singleton `config` row
// as Site Settings, gated the same way (`WEBSITE_ADMINISTRATOR,ADMINISTRATOR` in legacy; this
// schema only has `BemaAdministrator`). See docs/decisions/0020-payment-config.md for what of
// the legacy mega-form this covers and what's deliberately not modeled.
const CONFIG_ROLES = ['BemaAdministrator'] as const;

export async function GET(request: NextRequest) {
  const auth = await requireBemaSession(request, [...CONFIG_ROLES]);
  if (auth.response) return auth.response;

  const config = await db.config.findUnique({ where: { id: 1 } });
  return NextResponse.json({
    config: {
      gatewayLogin: config?.gatewayLogin ?? '',
      gatewayTransKey: config?.gatewayTransKey ?? '',
      paypalUserId: config?.paypalUserId ?? '',
      paypalPassword: config?.paypalPassword ?? '',
      paypalTransactionKey: config?.paypalTransactionKey ?? '',
      paypalEmail: config?.paypalEmail ?? '',
    },
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireBemaSession(request, [...CONFIG_ROLES]);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = paymentConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  // `gateway` is always `"authorizenet"` — the only value the live `<select>` can submit.
  // `feeAmount`/`feeType`/`paypalEnabled` are hidden inputs with no live control and always
  // submit `0`/`"$"`/`true`; not stored at all (they never vary, so there's no admin-set
  // state to persist — see docs/decisions/0020-payment-config.md), matching the same
  // constants legacy's hidden inputs always send on every save.
  const config = await db.config.upsert({
    where: { id: 1 },
    create: { id: 1, gateway: 'authorizenet', ...input },
    update: { gateway: 'authorizenet', ...input },
  });

  return NextResponse.json({
    config: {
      gatewayLogin: config.gatewayLogin ?? '',
      gatewayTransKey: config.gatewayTransKey ?? '',
      paypalUserId: config.paypalUserId ?? '',
      paypalPassword: config.paypalPassword ?? '',
      paypalTransactionKey: config.paypalTransactionKey ?? '',
      paypalEmail: config.paypalEmail ?? '',
    },
  });
}
