import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  InvalidNameError,
  createFolder,
  deleteFile,
  deleteFolder,
  editorFileUrl,
  listFiles,
  listFolders,
  saveUploadedFile,
} from '../editorFiles';

const UPLOADS_ROOT = path.join(process.cwd(), 'public', 'uploads', 'editor');

describe('editorFiles', () => {
  beforeEach(async () => {
    await fs.rm(UPLOADS_ROOT, { recursive: true, force: true });
  });
  afterEach(async () => {
    await fs.rm(UPLOADS_ROOT, { recursive: true, force: true });
  });

  test('listFolders bootstraps images/pdfs/other when empty, matching legacy', async () => {
    expect(await listFolders()).toEqual(['images', 'other', 'pdfs']);
  });

  test('createFolder/deleteFolder round-trip', async () => {
    await createFolder('flyers');
    expect(await listFolders()).toContain('flyers');
    await deleteFolder('flyers');
    expect(await listFolders()).not.toContain('flyers');
  });

  test('rejects unsafe folder names — closes the path-traversal gap legacy has', async () => {
    await expect(createFolder('../../etc')).rejects.toThrow(InvalidNameError);
    await expect(listFiles('../../etc', { page: 1, perPage: 10, dir: 'asc' })).rejects.toThrow(InvalidNameError);
  });

  test('saveUploadedFile dedupes a colliding filename, matching nameconflict=makeunique intent', async () => {
    await createFolder('pdfs');
    const first = await saveUploadedFile('pdfs', 'doc.txt', Buffer.from('one'));
    const second = await saveUploadedFile('pdfs', 'doc.txt', Buffer.from('two'));
    expect(first.name).toBe('doc.txt');
    expect(second.name).toBe('doc_1.txt');
  });

  test('saveUploadedFile with both width and height stretches to that exact size', async () => {
    await createFolder('images');
    const png = await makeTestPng(20, 10);
    const saved = await saveUploadedFile('images', 'pic.png', png, { width: 40, height: 40 });
    const sharp = (await import('sharp')).default;
    const meta = await sharp(await fs.readFile(path.join(UPLOADS_ROOT, 'images', saved.name))).metadata();
    expect(meta.width).toBe(40);
    expect(meta.height).toBe(40);
  });

  test('saveUploadedFile with only width scales proportionally, preserving aspect ratio', async () => {
    await createFolder('images');
    const png = await makeTestPng(20, 10);
    const saved = await saveUploadedFile('images', 'pic2.png', png, { width: 40 });
    const sharp = (await import('sharp')).default;
    const meta = await sharp(await fs.readFile(path.join(UPLOADS_ROOT, 'images', saved.name))).metadata();
    expect(meta.width).toBe(40);
    expect(meta.height).toBe(20);
  });

  test('listFiles sorts by filename, filters by search, and paginates', async () => {
    await createFolder('pdfs');
    for (const name of ['banana.txt', 'apple.txt', 'cherry.txt']) {
      await saveUploadedFile('pdfs', name, Buffer.from('x'));
    }
    const asc = await listFiles('pdfs', { page: 1, perPage: 10, dir: 'asc' });
    expect(asc.files.map((f) => f.name)).toEqual(['apple.txt', 'banana.txt', 'cherry.txt']);

    const desc = await listFiles('pdfs', { page: 1, perPage: 10, dir: 'desc' });
    expect(desc.files.map((f) => f.name)).toEqual(['cherry.txt', 'banana.txt', 'apple.txt']);

    const searched = await listFiles('pdfs', { page: 1, perPage: 10, dir: 'asc', search: 'ban' });
    expect(searched.files.map((f) => f.name)).toEqual(['banana.txt']);

    const paged = await listFiles('pdfs', { page: 2, perPage: 2, dir: 'asc' });
    expect(paged.files.map((f) => f.name)).toEqual(['cherry.txt']);
    expect(paged.total).toBe(3);
  });

  test('deleteFile removes the file', async () => {
    await createFolder('pdfs');
    await saveUploadedFile('pdfs', 'gone.txt', Buffer.from('x'));
    await deleteFile('pdfs', 'gone.txt');
    const { files } = await listFiles('pdfs', { page: 1, perPage: 10, dir: 'asc' });
    expect(files).toEqual([]);
  });

  test('editorFileUrl encodes folder/filename', () => {
    expect(editorFileUrl('my folder', 'a b.png')).toBe('/uploads/editor/my%20folder/a%20b.png');
  });
});

async function makeTestPng(width: number, height: number): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  return sharp({ create: { width, height, channels: 3, background: { r: 255, g: 0, b: 0 } } }).png().toBuffer();
}
