import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';
import { pageSchema } from '@/lib/validation/pageSchema';
import { revalidatePagePath } from '@/lib/services/revalidatePage';

const PAGE_ROLES = ['BemaStandard', 'BemaAdministrator'] as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBemaSession(request, [...PAGE_ROLES]);
  if (auth.response) return auth.response;

  const { id } = await params;
  const page = await db.page.findUnique({ where: { id } });
  if (!page) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  return NextResponse.json({ page });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBemaSession(request, [...PAGE_ROLES]);
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = pageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await db.page.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const conflict = await db.page.findFirst({
    where: { id: { not: id }, locale: parsed.data.locale, slug: parsed.data.slug },
  });
  if (conflict) {
    return NextResponse.json({ error: 'A page with this locale and slug already exists.' }, { status: 409 });
  }

  const updated = await db.page.update({ where: { id }, data: parsed.data });

  // Revalidate both the old and new path — a slug/locale rename must not leave the previous
  // URL serving stale cached content after this save.
  revalidatePagePath(existing.locale, existing.slug);
  if (existing.locale !== updated.locale || existing.slug !== updated.slug) {
    revalidatePagePath(updated.locale, updated.slug);
  }

  return NextResponse.json({ page: updated });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBemaSession(request, [...PAGE_ROLES]);
  if (auth.response) return auth.response;

  const { id } = await params;
  const existing = await db.page.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  await db.page.delete({ where: { id } });
  revalidatePagePath(existing.locale, existing.slug);

  return new NextResponse(null, { status: 204 });
}
