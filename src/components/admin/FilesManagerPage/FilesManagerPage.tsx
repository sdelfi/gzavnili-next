'use client';

import { useEffect, useState } from 'react';
import { PageHeading } from '@/components/ui/admin/PageHeading';
import { Field } from '@/components/ui/admin/Field';
import { Input } from '@/components/ui/admin/Input';
import { Checkbox } from '@/components/ui/admin/Checkbox';
import { Button } from '@/components/ui/admin/Button';
import { IconButton } from '@/components/ui/admin/IconButton';
import { ErrorList } from '@/components/ui/admin/Alert';
import { Table, type Column } from '@/components/ui/admin/Table';
import { Pagination } from '@/components/ui/admin/Pagination';
import {
  createFolder,
  deleteFile,
  deleteFolder,
  editorFileUrl,
  listFiles,
  listFolders,
  uploadFile,
  type EditorFile,
} from '@/lib/api/bema/files';
import { ApiError, extractErrorMessages } from '@/lib/api/http';
import s from './FilesManagerPage.module.css';

const PER_PAGE = 10;

function formatSize(bytes: number): string {
  return `${(bytes / 1000).toFixed(2)}`;
}

function formatModified(iso: string): string {
  const date = new Date(iso);
  return `${date.toLocaleDateString('en-US')} ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

// bema "Files" (legacy `bema/files.cfm` + `views/vwFiles.cfm`) — a plain folder/file manager
// on local disk (no DB table, matching legacy). See docs/decisions/0032-bema-files.md.
export function FilesManagerPage() {
  const [folders, setFolders] = useState<string[]>([]);
  const [folder, setFolder] = useState<string | null>(null);
  const [files, setFiles] = useState<EditorFile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');

  const [newFolderName, setNewFolderName] = useState('');
  const [uploadFileInput, setUploadFileInput] = useState<File | null>(null);
  const [resize, setResize] = useState(false);
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');

  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // `folderVersion`/`filesVersion` are bumped after a create/delete/upload so the effects
  // below re-fetch without the component needing to call a shared "load" function directly
  // from inside an effect (react-hooks flags that shape as an uncontrolled cascading
  // render — see AuthProvider/UserListPage/Sidebar for the same avoidance elsewhere in
  // this codebase).
  const [folderVersion, setFolderVersion] = useState(0);
  const [filesVersion, setFilesVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listFolders()
      .then((data) => {
        if (cancelled) return;
        setFolders(data.folders);
        setFolder((prev) => (prev && data.folders.includes(prev) ? prev : (data.folders[0] ?? null)));
      })
      .catch((err) => {
        if (cancelled) return;
        setErrors([err instanceof Error ? err.message : 'Failed to load folders.']);
      });
    return () => {
      cancelled = true;
    };
  }, [folderVersion]);

  useEffect(() => {
    if (!folder) return;
    let cancelled = false;
    listFiles({ folder, page, perPage: PER_PAGE, dir, search: search || undefined })
      .then((data) => {
        if (cancelled) return;
        setFiles(data.files);
        setTotal(data.total);
      })
      .catch((err) => {
        if (cancelled) return;
        setErrors([err instanceof Error ? err.message : 'Failed to load files.']);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [folder, page, dir, search, filesVersion]);

  async function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setErrors([]);
    setSubmitting(true);
    try {
      const created = newFolderName.trim();
      await createFolder(created);
      setNewFolderName('');
      setFolder(created);
      setFolderVersion((v) => v + 1);
    } catch (err) {
      setErrors(err instanceof ApiError ? extractErrorMessages(err.body) : ['Failed to create folder.']);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteFolder() {
    if (!folder) return;
    if (!window.confirm('Are you sure you want to delete this folder and all files within?')) return;
    setErrors([]);
    try {
      await deleteFolder(folder);
      setFolder(null);
      setFolderVersion((v) => v + 1);
    } catch (err) {
      setErrors(err instanceof ApiError ? extractErrorMessages(err.body) : ['Failed to delete folder.']);
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!folder || !uploadFileInput) {
      setErrors(['Please specify a file.']);
      return;
    }
    if (resize && !width && !height) {
      setErrors(['You need to specify either a width or a height if you want to resize the image.']);
      return;
    }
    setErrors([]);
    setSubmitting(true);
    try {
      await uploadFile({
        folder,
        file: uploadFileInput,
        resize,
        width: width ? Number(width) : undefined,
        height: height ? Number(height) : undefined,
      });
      setUploadFileInput(null);
      setResize(false);
      setWidth('');
      setHeight('');
      setPage(1);
      setFilesVersion((v) => v + 1);
    } catch (err) {
      setErrors(err instanceof ApiError ? extractErrorMessages(err.body) : ['Failed to upload file.']);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteFile(filename: string) {
    if (!folder) return;
    if (!window.confirm('Are you sure you want to delete this file?')) return;
    setErrors([]);
    try {
      await deleteFile(folder, filename);
      setFilesVersion((v) => v + 1);
    } catch (err) {
      setErrors(err instanceof ApiError ? extractErrorMessages(err.body) : ['Failed to delete file.']);
    }
  }

  const columns: Column<EditorFile>[] = [
    {
      key: 'name',
      label: 'Filename',
      sortable: true,
      render: (f) => (
        <a href={folder ? editorFileUrl(folder, f.name) : '#'} target="_blank" rel="noreferrer">
          {f.name}
        </a>
      ),
    },
    { key: 'modified', label: 'Modified', render: (f) => formatModified(f.modified) },
    { key: 'size', label: 'Size (KB)', render: (f) => formatSize(f.size) },
    {
      key: 'actions',
      label: 'Delete',
      render: (f) => <IconButton icon="delete" title="Delete file" onClick={() => handleDeleteFile(f.name)} />,
    },
  ];

  return (
    <div>
      <PageHeading>Manage Files</PageHeading>
      <ErrorList errors={errors} />

      <div className={s.layout}>
        <div className={s.folders}>
          <h3>Folders:</h3>
          <ul className={s.folderList}>
            {folders.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  className={name === folder ? s.folderActive : s.folderLink}
                  onClick={() => {
                    setFolder(name);
                    setPage(1);
                  }}
                >
                  {name}
                </button>
              </li>
            ))}
          </ul>

          <form className={s.createFolder} onSubmit={handleCreateFolder}>
            <Field label="Create folder:" htmlFor="new-folder">
              <Input
                id="new-folder"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                maxLength={25}
              />
            </Field>
            <Button type="submit" disabled={submitting}>
              Go
            </Button>
          </form>
        </div>

        <div className={s.files}>
          <div className={s.filesHeader}>
            <h3>
              Files{folder ? <> » {folder}</> : null}
            </h3>
            {folder && (
              <Button type="button" variant="danger" onClick={handleDeleteFolder}>
                Delete Folder
              </Button>
            )}
          </div>

          <div className={s.search}>
            <Field label="Search for:" htmlFor="file-search" inline>
              <Input
                id="file-search"
                defaultValue={search}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setSearch((e.target as HTMLInputElement).value);
                    setPage(1);
                  }
                }}
              />
            </Field>
          </div>

          <Table
            columns={columns}
            rows={files}
            sort={{ key: 'name', dir }}
            onSort={() => setDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
            getRowKey={(f) => f.name}
            emptyMessage={loading ? 'Loading…' : 'There are currently no files.'}
          />

          <Pagination page={page} perPage={PER_PAGE} total={total} onPageChange={setPage} />

          <form className={s.upload} onSubmit={handleUpload}>
            <h3>Upload a File</h3>
            <input
              type="file"
              onChange={(e) => setUploadFileInput(e.target.files?.[0] ?? null)}
              disabled={!folder}
            />
            <div className={s.resizeRow}>
              <Checkbox
                label="Resize image to"
                checked={resize}
                onChange={(e) => setResize(e.target.checked)}
              />
              <Input
                type="number"
                placeholder="width (pixels)"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                disabled={!resize}
                min={0}
              />
              <span>x</span>
              <Input
                type="number"
                placeholder="height (pixels)"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                disabled={!resize}
                min={0}
              />
            </div>
            <Button type="submit" disabled={submitting || !folder}>
              Upload
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
