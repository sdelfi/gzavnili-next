import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';
import { pageSchema, listPagesQuerySchema } from '@/lib/validation/pageSchema';
import { revalidatePagePath } from '@/lib/services/revalidatePage';

// Matches the legacy `bema/content/pages.cfm`'s allow-list
// (`groups="WEBSITE_ADMINISTRATOR,CONTENT_ONLY,ADMINISTRATOR"`) — a dedicated
// content-editor role (`CONTENT_ONLY`) exists in legacy with no equivalent in this schema's
// `AdminRole` enum (`BemaStandard`/`BemaAdministrator`/`BemaAgent`, see
// docs/decisions/0011-bema-admin.md) since none of the seeded/real bema accounts use it yet
// — allowing the two roles that do exist and can plausibly need this, not inventing a role
// with no accounts to assign it to. Revisit if a content-only editor role is actually needed.
const PAGE_ROLES = ['BemaStandard', 'BemaAdministrator'] as const;

export async function GET(request: NextRequest) {
  const auth = await requireBemaSession(request, [...PAGE_ROLES]);
  if (auth.response) return auth.response;

  const parsed = listPagesQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { page, perPage, search, locale, sort, dir } = parsed.data;

  const keywordFilters = (search ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => ({
      OR: [
        { name: { contains: term, mode: 'insensitive' as const } },
        { slug: { contains: term, mode: 'insensitive' as const } },
      ],
    }));

  const where = {
    ...(locale ? { locale } : {}),
    AND: keywordFilters,
  };

  const [total, items] = await Promise.all([
    db.page.count({ where }),
    db.page.findMany({
      where,
      orderBy: { [sort]: dir },
      skip: (page - 1) * perPage,
      take: perPage,
      select: { id: true, slug: true, locale: true, name: true, updatedAt: true },
    }),
  ]);

  return NextResponse.json({ items, total, page, perPage });
}

export async function POST(request: NextRequest) {
  const auth = await requireBemaSession(request, [...PAGE_ROLES]);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = pageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await db.page.findUnique({
    where: { locale_slug: { locale: parsed.data.locale, slug: parsed.data.slug } },
  });
  if (existing) {
    return NextResponse.json({ error: 'A page with this locale and slug already exists.' }, { status: 409 });
  }

  const created = await db.page.create({ data: parsed.data });
  revalidatePagePath(created.locale, created.slug);

  return NextResponse.json({ page: created }, { status: 201 });
}
