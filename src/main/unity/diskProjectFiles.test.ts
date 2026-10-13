import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { diskProjectFiles } from './diskProjectFiles';

const failing = (code: string) => () => Promise.reject(Object.assign(new Error(`${code}: busy`), { code }));

describe('diskProjectFiles', () => {
  it("reads a folder's entries and a file's first bytes, none for what isn't there", async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'project-files-'));
    await mkdir(join(workspace, 'Assets', 'Art'), { recursive: true });
    await writeFile(join(workspace, 'Assets', 'a.png.meta'), 'fileFormatVersion: 2\nguid: abc\n');
    const files = diskProjectFiles(workspace);
    expect((await files.list('Assets')).sort((a, b) => a.name.localeCompare(b.name))).toEqual([
      { name: 'a.png.meta', isFolder: false },
      { name: 'Art', isFolder: true },
    ]);
    expect(await files.head('Assets/a.png.meta', 20)).toBe('fileFormatVersion: 2');
    expect(await files.list('Missing')).toEqual([]);
    expect(await files.list('Assets/a.png.meta')).toEqual([]);
    expect(await files.head('Assets/gone.meta', 20)).toBeNull();
  });

  it('fails a read the disk refused for any other reason, so that nothing of it is kept as an answer', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'project-files-'));
    const files = diskProjectFiles(workspace, { readdir: failing('EMFILE'), open: failing('EBUSY') });
    await expect(files.list('Assets')).rejects.toThrow('EMFILE');
    await expect(files.head('Assets/a.png.meta', 20)).rejects.toThrow('EBUSY');
  });

  it('keeps at most a few dozen files open at once, however many reads are asked for', async () => {
    let open = 0;
    let most = 0;
    const slow = async () => {
      most = Math.max(most, ++open);
      await new Promise((resolve) => setImmediate(resolve));
      open--;
      return [];
    };
    const files = diskProjectFiles(await mkdtemp(join(tmpdir(), 'project-files-')), { readdir: slow, open: failing('ENOENT') });
    await Promise.all(Array.from({ length: 300 }, (_, i) => files.list(`F${i}`)));
    expect(most).toBe(32);
  });
});
