import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';
import { popupConfigSchema } from '@/lib/validation/configSchema';

// Singleton `config` row (see prisma/schema.prisma's `Config` model) — only the
// popup-related fields are exposed here, see docs/decisions/0014-site-popup.md.
const CONFIG_ROLES = ['BemaAdministrator'] as const;

export async function GET(request: NextRequest) {
  const auth = await requireBemaSession(request, [...CONFIG_ROLES]);
  if (auth.response) return auth.response;

  const config = await db.config.findUnique({ where: { id: 1 } });
  return NextResponse.json({
    config: {
      popupEnabled: config?.popupEnabled ?? false,
      popupMessageEn: config?.popupMessageEn ?? '',
      popupMessageGe: config?.popupMessageGe ?? '',
    },
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireBemaSession(request, [...CONFIG_ROLES]);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = popupConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const config = await db.config.upsert({
    where: { id: 1 },
    create: { id: 1, ...parsed.data },
    update: parsed.data,
  });

  return NextResponse.json({
    config: {
      popupEnabled: config.popupEnabled,
      popupMessageEn: config.popupMessageEn ?? '',
      popupMessageGe: config.popupMessageGe ?? '',
    },
  });
}
