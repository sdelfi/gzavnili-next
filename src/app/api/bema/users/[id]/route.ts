import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';
import { hashPassword } from '@/lib/auth/password';
import { publicUser } from '@/lib/auth/publicUser';
import { updateUserSchema } from '@/lib/validation/userSchema';
import { USER_DETAIL_INCLUDE, upsertAddress } from '@/lib/services/userAddress';

// Broader than the list screen's allow-list, matching the legacy `user_edit.cfm`'s
// `groups="WEBSITE_ADMINISTRATOR,ADMINISTRATOR,AGENT_ADMINISTRATOR"` — an Agent
// Administrator can open/edit one record even though they can't browse the full list.
const EDIT_ROLES = ['BemaStandard', 'BemaAdministrator', 'BemaAgent'] as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBemaSession(request, [...EDIT_ROLES]);
  if (auth.response) return auth.response;

  const { id } = await params;
  const user = await db.user.findUnique({ where: { id }, include: USER_DETAIL_INCLUDE });
  if (!user) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  return NextResponse.json({ user: publicUser(user) });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBemaSession(request, [...EDIT_ROLES]);
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { password, passwordShort, billingAddress, shippingAddress, notificationMessageTypeKeys, ...data } =
    parsed.data;

  const existing = await db.user.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  if (data.username || data.email) {
    const conflict = await db.user.findFirst({
      where: {
        id: { not: id },
        OR: [...(data.username ? [{ username: data.username }] : []), ...(data.email ? [{ email: data.email }] : [])],
      },
    });
    if (conflict) {
      return NextResponse.json({ error: 'Username or email is already in use.' }, { status: 409 });
    }
  }

  const passwordFields = password ? await hashPassword(password) : null;
  const passwordShortHash = passwordShort ? (await hashPassword(passwordShort)).hash : undefined;

  const user = await db.$transaction(async (tx) => {
    const billingAddressId = await upsertAddress(tx, existing.billingAddressId, billingAddress);
    const shippingAddressId = await upsertAddress(tx, existing.shippingAddressId, shippingAddress);
    return tx.user.update({
      where: { id },
      data: {
        ...data,
        ...(passwordFields ? { passwordHash: passwordFields.hash, passwordAlgo: passwordFields.algo } : {}),
        ...(passwordShortHash !== undefined ? { passwordShortHash } : {}),
        billingAddressId,
        shippingAddressId,
        ...(notificationMessageTypeKeys
          ? { notificationMessageTypes: { set: notificationMessageTypeKeys.map((key) => ({ key })) } }
          : {}),
      },
      include: USER_DETAIL_INCLUDE,
    });
  });

  return NextResponse.json({ user: publicUser(user) });
}

// No DELETE — matches the legacy DAO's `delete()`, which is a stub/no-op there too.
// Deactivation is `PATCH { active: false }`, not a hard delete.
