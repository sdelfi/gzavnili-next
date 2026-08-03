import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

// Ports `bema/files.cfm` + `model.util.files.Folder`/`File`/`Image` — the "Files" bema Sidebar
// entry (distinct from `bema/content/files.cfm`, a TinyMCE `file_browser_callback` popup with
// no reachable consumer here since `PageForm` uses a plain textarea, not TinyMCE — see
// docs/decisions/0032-bema-files.md). Legacy has no `files`/`folders` DB table at all: it's a
// pure filesystem scan of `application.folders.editor` (`<approot>/include/pages/files`),
// reproduced the same way here against `UPLOADS_ROOT` — no Prisma model for this feature.
//
// Legacy's own folder-name sanitization (`reFindNoCase("[^A-Za-z0-9\-_]", ...)`) is only ever
// applied on *create*, not on the "does this folder exist" GET branch — a real path-traversal
// gap (`folder=../../../etc` would pass `directoryExists()` if such a path existed and then
// list it). Every folder/filename argument here is validated against the same safe charset
// before it ever reaches the filesystem, closing that gap rather than reproducing it — a
// security fix, not a business-logic deviation, so it isn't a "bug ported as-is" case. See
// docs/findings.md.

const UPLOADS_ROOT = path.join(process.cwd(), 'public', 'uploads', 'editor');
const DEFAULT_FOLDERS = ['images', 'pdfs', 'other'];
const SAFE_NAME = /^[A-Za-z0-9_-]+$/;

export class InvalidNameError extends Error {}

function assertSafeName(name: string): void {
  if (!SAFE_NAME.test(name)) throw new InvalidNameError('Invalid name.');
}

async function ensureRoot(): Promise<void> {
  await fs.mkdir(UPLOADS_ROOT, { recursive: true });
}

/** Legacy's own "there are no folders, so create some defaults" bootstrap. */
export async function listFolders(): Promise<string[]> {
  await ensureRoot();
  const entries = await fs.readdir(UPLOADS_ROOT, { withFileTypes: true });
  let folders = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  if (folders.length === 0) {
    for (const name of DEFAULT_FOLDERS) {
      await fs.mkdir(path.join(UPLOADS_ROOT, name), { recursive: true });
    }
    folders = DEFAULT_FOLDERS;
  }
  return folders.sort((a, b) => a.localeCompare(b));
}

export async function createFolder(name: string): Promise<void> {
  assertSafeName(name);
  await fs.mkdir(path.join(UPLOADS_ROOT, name), { recursive: true });
}

export async function deleteFolder(name: string): Promise<void> {
  assertSafeName(name);
  await fs.rm(path.join(UPLOADS_ROOT, name), { recursive: true, force: true });
}

export type EditorFile = {
  name: string;
  modified: string;
  size: number;
};

export type ListFilesResult = {
  files: EditorFile[];
  total: number;
};

/** Legacy's `Folder.getFiles()`: filename-only sort (the only sortable column the view ever
 *  offers), substring `keywords` filter, page/perPage slicing. */
export async function listFiles(
  folder: string,
  { page, perPage, dir, search }: { page: number; perPage: number; dir: 'asc' | 'desc'; search?: string },
): Promise<ListFilesResult> {
  assertSafeName(folder);
  const dirPath = path.join(UPLOADS_ROOT, folder);
  let entries: string[];
  try {
    const dirents = await fs.readdir(dirPath, { withFileTypes: true });
    entries = dirents.filter((e) => e.isFile()).map((e) => e.name);
  } catch {
    entries = [];
  }
  if (search) {
    const needle = search.toLowerCase();
    entries = entries.filter((name) => name.toLowerCase().includes(needle));
  }
  entries.sort((a, b) => (dir === 'desc' ? b.localeCompare(a) : a.localeCompare(b)));

  const total = entries.length;
  const start = (page - 1) * perPage;
  const pageNames = entries.slice(start, start + perPage);
  const files = await Promise.all(
    pageNames.map(async (name) => {
      const stat = await fs.stat(path.join(dirPath, name));
      return { name, modified: stat.mtime.toISOString(), size: stat.size };
    }),
  );
  return { files, total };
}

function uniqueFilename(dirPath: string, filename: string): Promise<string> {
  return (async () => {
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    let candidate = filename;
    let i = 1;
    while (
      await fs
        .access(path.join(dirPath, candidate))
        .then(() => true)
        .catch(() => false)
    ) {
      candidate = `${base}_${i}${ext}`;
      i += 1;
    }
    return candidate;
  })();
}

/** Legacy's optional "Resize image to WxH" checkbox on upload — `ImageResize(img, width,
 *  height)` semantics: both dimensions given stretches to that exact size (no aspect-ratio
 *  preservation); only one given scales proportionally from that one. Applied to the file at
 *  its final saved location, matching legacy resizing the already-uploaded file in place
 *  (`Image.resize()` mutates `locationOnServer` directly) rather than a separate copy.
 *
 *  The `/thumbs/` copy legacy's own upload handler also writes is NOT reproduced: nothing in
 *  `vwFiles.cfm` (this screen's own view) ever reads it — see docs/findings.md. */
export async function saveUploadedFile(
  folder: string,
  originalName: string,
  data: Buffer,
  resize?: { width?: number; height?: number },
): Promise<EditorFile> {
  assertSafeName(folder);
  const dirPath = path.join(UPLOADS_ROOT, folder);
  await fs.mkdir(dirPath, { recursive: true });

  const safeName = path.basename(originalName).replace(/[/\\]/g, '_');
  const filename = await uniqueFilename(dirPath, safeName);
  const destination = path.join(dirPath, filename);

  let output = data;
  if (resize && (resize.width || resize.height)) {
    output = await sharp(data)
      .resize(resize.width || null, resize.height || null, resize.width && resize.height ? { fit: 'fill' } : {})
      .toBuffer();
  }
  await fs.writeFile(destination, output);

  const stat = await fs.stat(destination);
  return { name: filename, modified: stat.mtime.toISOString(), size: stat.size };
}

export async function deleteFile(folder: string, filename: string): Promise<void> {
  assertSafeName(folder);
  const safeName = path.basename(filename);
  await fs.rm(path.join(UPLOADS_ROOT, folder, safeName), { force: true });
}

/** The public, statically-served URL — matches legacy's own unauthenticated
 *  `../include/pages/files/<folder>/<file>` static asset link (no bema auth check on the
 *  file itself, only on the management screens). */
export function editorFileUrl(folder: string, filename: string): string {
  return `/uploads/editor/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}`;
}
