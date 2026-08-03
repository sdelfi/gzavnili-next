import { NextRequest, NextResponse } from 'next/server';
import { requireBemaSession } from '@/lib/auth/session';
import { deleteFolder, InvalidNameError, listFolders } from '@/lib/services/editorFiles';

const ROLES = ['BemaAdministrator'] as const;

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ folder: string }> }) {
  const auth = await requireBemaSession(request, [...ROLES]);
  if (auth.response) return auth.response;

  const { folder } = await params;
  try {
    await deleteFolder(folder);
  } catch (err) {
    if (err instanceof InvalidNameError) {
      return NextResponse.json({ error: 'Invalid folder name.' }, { status: 400 });
    }
    throw err;
  }

  const folders = await listFolders();
  return NextResponse.json({ folders });
}
