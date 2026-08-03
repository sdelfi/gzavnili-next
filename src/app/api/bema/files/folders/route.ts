import { NextRequest, NextResponse } from 'next/server';
import { requireBemaSession } from '@/lib/auth/session';
import { createFolder, InvalidNameError, listFolders } from '@/lib/services/editorFiles';
import { folderNameSchema } from '@/lib/validation/editorFilesSchema';

// bema "Files" (`bema/files.cfm`) — see docs/decisions/0032-bema-files.md. Legacy gates this
// whole nav section on `session.buser.listGroups('ADMINISTRATOR')`.
const ROLES = ['BemaAdministrator'] as const;

export async function GET(request: NextRequest) {
  const auth = await requireBemaSession(request, [...ROLES]);
  if (auth.response) return auth.response;

  const folders = await listFolders();
  return NextResponse.json({ folders });
}

export async function POST(request: NextRequest) {
  const auth = await requireBemaSession(request, [...ROLES]);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = folderNameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await createFolder(parsed.data.name);
  } catch (err) {
    if (err instanceof InvalidNameError) {
      return NextResponse.json({ error: { formErrors: [err.message] } }, { status: 400 });
    }
    throw err;
  }

  const folders = await listFolders();
  return NextResponse.json({ folders }, { status: 201 });
}
