import { apiDelete, apiGet, apiPost, apiUpload } from '../http';

// bema "Files" (`bema/files.cfm`) — see docs/decisions/0032-bema-files.md.

export function listFolders() {
  return apiGet<{ folders: string[] }>('/api/bema/files/folders');
}

export function createFolder(name: string) {
  return apiPost<{ folders: string[] }>('/api/bema/files/folders', { name });
}

export function deleteFolder(name: string) {
  return apiDelete<{ folders: string[] }>(`/api/bema/files/folders/${encodeURIComponent(name)}`);
}

export type EditorFile = {
  name: string;
  modified: string;
  size: number;
};

export type ListFilesParams = {
  folder: string;
  page: number;
  perPage: number;
  dir: 'asc' | 'desc';
  search?: string;
};

export function listFiles(params: ListFilesParams) {
  const qs = new URLSearchParams({
    folder: params.folder,
    page: String(params.page),
    perPage: String(params.perPage),
    dir: params.dir,
    ...(params.search ? { search: params.search } : {}),
  });
  return apiGet<{ files: EditorFile[]; total: number }>(`/api/bema/files?${qs.toString()}`);
}

export type UploadFileParams = {
  folder: string;
  file: File;
  resize?: boolean;
  width?: number;
  height?: number;
};

export function uploadFile(params: UploadFileParams) {
  const formData = new FormData();
  formData.set('folder', params.folder);
  formData.set('file', params.file);
  if (params.resize) {
    formData.set('resize', '1');
    if (params.width) formData.set('width', String(params.width));
    if (params.height) formData.set('height', String(params.height));
  }
  return apiUpload<{ file: EditorFile }>('/api/bema/files', formData);
}

export function deleteFile(folder: string, filename: string) {
  return apiDelete<{ ok: true }>(`/api/bema/files/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}`);
}

/** The public, statically-served URL for a stored file — matches legacy's own
 *  unauthenticated static asset link. */
export function editorFileUrl(folder: string, filename: string): string {
  return `/uploads/editor/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}`;
}
