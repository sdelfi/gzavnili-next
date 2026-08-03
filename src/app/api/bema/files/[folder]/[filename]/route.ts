import { NextRequest, NextResponse } from 'next/server';
import { requireBemaSession } from '@/lib/auth/session';
import { deleteFile, InvalidNameError } from '@/lib/services/editorFiles';

const ROLES = ['BemaAdministrator'] as const;

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ folder: string; filename: string }> },
) {
  const auth = await requireBemaSession(request, [...ROLES]);
  if (auth.response) return auth.response;

  const { folder, filename } = await params;
  try {
    await deleteFile(decodeURIComponent(folder), decodeURIComponent(filename));
  } catch (err) {
    if (err instanceof InvalidNameError) {
      return NextResponse.json({ error: 'Invalid folder name.' }, { status: 400 });
    }
    throw err;
  }

  return NextResponse.json({ ok: true });
}
