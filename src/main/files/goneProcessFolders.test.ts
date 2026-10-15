import { mkdir, mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isFolderOfGoneProcess, removeFoldersOfGoneProcesses } from './goneProcessFolders';

describe('folders of gone processes', () => {
  const owners = { pid: 300, isRunning: (pid: number) => pid === 200 };

  it("are those named with a process that is gone: never another running app's, this one's, or one not named by its owner", () => {
    const gone = (name: string, prefix = 'uvcs-') => isFolderOfGoneProcess(name, { prefix, ...owners });
    expect(gone('uvcs-100-a1B2c3')).toBe(true);
    expect(gone('uvcs-revisions-100-a1B2c3', 'uvcs-revisions-')).toBe(true);
    expect(['uvcs-200-d4E5f6', 'uvcs-300-g7H8i9', 'uvcs-rev-j1K2l3', 'uvcs-revisions-100-m4N5o6', 'uvcs-123456', 'other-100-x'].map((name) => gone(name))).toEqual([false, false, false, false, false, false]);
  });

  it('are deleted from the temp folder, the others left', async () => {
    const tempFolder = await mkdtemp(join(tmpdir(), 'left-over-'));
    for (const name of ['uvcs-100-a1B2c3', 'uvcs-200-d4E5f6']) await mkdir(join(tempFolder, name));
    await removeFoldersOfGoneProcesses({ tempFolder, prefix: 'uvcs-', ...owners });
    expect(await readdir(tempFolder)).toEqual(['uvcs-200-d4E5f6']);
  });
});
