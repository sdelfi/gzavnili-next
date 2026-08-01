import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';
import { siteSettingsSchema } from '@/lib/validation/configSchema';

// Singleton `config` row (see prisma/schema.prisma's `Config` model) — the full bema "Site
// Settings" screen, legacy `bema/config/settings.cfm`. Gated `BemaAdministrator` only,
// matching legacy's `WEBSITE_ADMINISTRATOR,ADMINISTRATOR` group requirement — this schema
// has no separate "website administrator" role to split out, see docs/findings.md.
const CONFIG_ROLES = ['BemaAdministrator'] as const;

function toDate(value: string | null | undefined) {
  return value ? new Date(value) : null;
}

function toIsoDate(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : null;
}

export async function GET(request: NextRequest) {
  const auth = await requireBemaSession(request, [...CONFIG_ROLES]);
  if (auth.response) return auth.response;

  const config = await db.config.findUnique({ where: { id: 1 } });
  return NextResponse.json({
    config: {
      siteMessage: config?.siteMessage ?? '',
      consignee: config?.consignee ?? '',

      popupEnabled: config?.popupEnabled ?? false,
      popupMessageEn: config?.popupMessageEn ?? '',
      popupMessageGe: config?.popupMessageGe ?? '',

      airwayBill: config?.airwayBill ?? '',
      airwayDate: toIsoDate(config?.airwayDate),

      dtRegularShip: toIsoDate(config?.dtRegularShip),
      dtRegularEst: toIsoDate(config?.dtRegularEst),
      regAwb: config?.regAwb ?? '',

      dtExpressShip: toIsoDate(config?.dtExpressShip),
      dtExpressEst: toIsoDate(config?.dtExpressEst),
      expAwb: config?.expAwb ?? '',

      dtCargoShip: toIsoDate(config?.dtCargoShip),
      dtCargoEst: toIsoDate(config?.dtCargoEst),

      crate: config?.crate ?? '',
      declaredPrice: config?.declaredPrice ?? '',
      nonDeclaredPrice: config?.nonDeclaredPrice ?? '',
    },
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireBemaSession(request, [...CONFIG_ROLES]);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = siteSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  const data = {
    siteMessage: input.siteMessage ?? null,
    consignee: input.consignee ?? null,

    popupEnabled: input.popupEnabled,
    popupMessageEn: input.popupMessageEn ?? null,
    popupMessageGe: input.popupMessageGe ?? null,

    airwayBill: input.airwayBill ?? null,
    airwayDate: toDate(input.airwayDate),

    dtRegularShip: toDate(input.dtRegularShip),
    dtRegularEst: toDate(input.dtRegularEst),
    regAwb: input.regAwb ?? null,

    dtExpressShip: toDate(input.dtExpressShip),
    dtExpressEst: toDate(input.dtExpressEst),
    expAwb: input.expAwb ?? null,

    dtCargoShip: toDate(input.dtCargoShip),
    dtCargoEst: toDate(input.dtCargoEst),

    crate: input.crate ?? null,
    declaredPrice: input.declaredPrice ?? null,
    nonDeclaredPrice: input.nonDeclaredPrice ?? null,
  };

  const config = await db.config.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: data,
  });

  return NextResponse.json({
    config: {
      siteMessage: config.siteMessage ?? '',
      consignee: config.consignee ?? '',
      popupEnabled: config.popupEnabled,
      popupMessageEn: config.popupMessageEn ?? '',
      popupMessageGe: config.popupMessageGe ?? '',
      airwayBill: config.airwayBill ?? '',
      airwayDate: toIsoDate(config.airwayDate),
      dtRegularShip: toIsoDate(config.dtRegularShip),
      dtRegularEst: toIsoDate(config.dtRegularEst),
      regAwb: config.regAwb ?? '',
      dtExpressShip: toIsoDate(config.dtExpressShip),
      dtExpressEst: toIsoDate(config.dtExpressEst),
      expAwb: config.expAwb ?? '',
      dtCargoShip: toIsoDate(config.dtCargoShip),
      dtCargoEst: toIsoDate(config.dtCargoEst),
      crate: config.crate ?? '',
      declaredPrice: config.declaredPrice ?? '',
      nonDeclaredPrice: config.nonDeclaredPrice ?? '',
    },
  });
}
