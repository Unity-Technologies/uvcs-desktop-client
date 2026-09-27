import { mkdtemp, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renamePrivate } from './renamePrivate';

describe('renamePrivate', () => {
  let folder: string;
  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), 'rename-private-'));
    await writeFile(join(folder, 'notes.txt'), 'n');
  });
  afterEach(() => rm(folder, { recursive: true, force: true }));

  it('renames the item on disk', async () => {
    await renamePrivate(join(folder, 'notes.txt'), join(folder, 'todo.txt'));
    expect(await readdir(folder)).toEqual(['todo.txt']);
  });

  it('changes only the case of a name', async () => {
    await renamePrivate(join(folder, 'notes.txt'), join(folder, 'Notes.txt'));
    expect(await readdir(folder)).toEqual(['Notes.txt']);
  });

  it('never replaces another item', async () => {
    await writeFile(join(folder, 'other.txt'), 'o');
    await expect(renamePrivate(join(folder, 'notes.txt'), join(folder, 'other.txt'))).rejects.toThrow('other.txt already exists.');
  });

  it('never replaces another item named like it but for case, where the disk tells them apart', async () => {
    await writeFile(join(folder, 'Notes.txt'), 'N');
    // Only a case-sensitive disk (Linux, some macOS volumes) holds both.
    if ((await readdir(folder)).length < 2) return;
    await expect(renamePrivate(join(folder, 'notes.txt'), join(folder, 'Notes.txt'))).rejects.toThrow('Notes.txt already exists.');
  });

  // Windows lets only administrators and Developer Mode create links.
  it.skipIf(process.platform === 'win32')('never replaces a broken link', async () => {
    await symlink(join(folder, 'missing'), join(folder, 'broken'));
    await expect(renamePrivate(join(folder, 'notes.txt'), join(folder, 'broken'))).rejects.toThrow('broken already exists.');
  });
});
