import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';
import { hashPassword } from '@/lib/auth/password';
import { publicUser } from '@/lib/auth/publicUser';
import { createUserSchema, listUsersQuerySchema } from '@/lib/validation/userSchema';

// List screen access, matching the legacy `users.cfm`'s
// `groups="WEBSITE_ADMINISTRATOR,ADMINISTRATOR"` — narrower than the edit screen's
// allow-list (see src/app/api/bema/users/[id]/route.ts).
const LIST_ROLES = ['BemaStandard', 'BemaAdministrator'] as const;

export async function GET(request: NextRequest) {
  const auth = await requireBemaSession(request, [...LIST_ROLES]);
  if (auth.response) return auth.response;

  const parsed = listUsersQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { accountType, page, perPage, search, active, sort, dir } = parsed.data;

  // Space-delimited AND-of-OR across name/username/email, matching the legacy
  // `getUsers()` keyword-search behavior (see the legacy-research notes this is based on).
  const keywordFilters: Prisma.UserWhereInput[] = (search ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => ({
      OR: [
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
        { username: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
      ],
    }));

  const where: Prisma.UserWhereInput = {
    accountType,
    ...(active ? { active: active === 'true' } : {}),
    AND: keywordFilters,
  };

  const [total, items] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { [sort]: dir },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ]);

  return NextResponse.json({ items: items.map(publicUser), total, page, perPage });
}

export async function POST(request: NextRequest) {
  const auth = await requireBemaSession(request, ['BemaStandard', 'BemaAdministrator', 'BemaAgent']);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { password, ...data } = parsed.data;

  const existing = await db.user.findFirst({ where: { OR: [{ username: data.username }, { email: data.email }] } });
  if (existing) {
    return NextResponse.json({ error: 'Username or email is already in use.' }, { status: 409 });
  }

  const { hash, algo } = await hashPassword(password);
  const user = await db.user.create({
    data: { ...data, passwordHash: hash, passwordAlgo: algo },
  });

  return NextResponse.json({ user: publicUser(user) }, { status: 201 });
}
