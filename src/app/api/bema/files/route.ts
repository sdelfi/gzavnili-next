import { NextRequest, NextResponse } from 'next/server';
import { requireBemaSession } from '@/lib/auth/session';
import { InvalidNameError, listFiles, saveUploadedFile } from '@/lib/services/editorFiles';
import { listFilesQuerySchema, uploadFileParamsSchema } from '@/lib/validation/editorFilesSchema';

const ROLES = ['BemaAdministrator'] as const;

export async function GET(request: NextRequest) {
  const auth = await requireBemaSession(request, [...ROLES]);
  if (auth.response) return auth.response;

  const parsed = listFilesQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { folder, page, perPage, dir, search } = parsed.data;

  try {
    const result = await listFiles(folder, { page, perPage, dir, search });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof InvalidNameError) {
      return NextResponse.json({ error: 'Invalid folder name.' }, { status: 400 });
    }
    throw err;
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireBemaSession(request, [...ROLES]);
  if (auth.response) return auth.response;

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: { formErrors: ['Please choose a file to upload.'] } }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: { formErrors: ['Please choose a file to upload.'] } }, { status: 400 });
  }

  const parsed = uploadFileParamsSchema.safeParse({
    folder: form.get('folder'),
    resize: form.get('resize'),
    width: form.get('width'),
    height: form.get('height'),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { folder, resize, width, height } = parsed.data;

  try {
    const saved = await saveUploadedFile(
      folder,
      file.name,
      Buffer.from(await file.arrayBuffer()),
      resize ? { width: width || undefined, height: height || undefined } : undefined,
    );
    return NextResponse.json({ file: saved }, { status: 201 });
  } catch (err) {
    if (err instanceof InvalidNameError) {
      return NextResponse.json({ error: { formErrors: ['Invalid folder name.'] } }, { status: 400 });
    }
    throw err;
  }
}
