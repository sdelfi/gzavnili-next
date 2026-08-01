import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';

// legacy `messages.cfm?id=...&action=active|inactive` (status toggle) and
// `messages.cfm?id=...&action=delete`.
const MESSAGE_ROLES = ['BemaAdministrator'] as const;

const patchSchema = z.object({ active: z.boolean() });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBemaSession(request, [...MESSAGE_ROLES]);
  if (auth.response) return auth.response;

  const { id } = await params;
  const messageId = Number(id);
  if (!Number.isInteger(messageId)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await db.message.findUnique({ where: { id: messageId } });
  if (!existing) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const updated = await db.message.update({ where: { id: messageId }, data: { active: parsed.data.active } });

  return NextResponse.json({ message: { id: updated.id, active: updated.active } });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBemaSession(request, [...MESSAGE_ROLES]);
  if (auth.response) return auth.response;

  const { id } = await params;
  const messageId = Number(id);
  if (!Number.isInteger(messageId)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const existing = await db.message.findUnique({ where: { id: messageId } });
  if (!existing) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  await db.message.delete({ where: { id: messageId } });

  return new NextResponse(null, { status: 204 });
}
