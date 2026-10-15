import { mkdir, mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { removeLeftOverTempDirectories, withTempPath } from './tempFile';

describe('temporary directories', () => {
  it('are named with the process that owns them', async () => {
    const directory = await withTempPath(async (path) => basename(dirname(path)));
    expect(directory).toMatch(new RegExp(`^uvcs-${process.pid}-`));
  });

  it("deletes those a killed session left, never another running app's, this one's, or a revision opened in an app", async () => {
    const tempFolder = await mkdtemp(join(tmpdir(), 'left-over-'));
    const names = ['uvcs-100-a1B2c3', 'uvcs-200-d4E5f6', 'uvcs-300-g7H8i9', 'uvcs-rev-j1K2l3', 'uvcs-revisions-100-m4N5o6', 'uvcs-123456'];
    for (const name of names) await mkdir(join(tempFolder, name));

    await removeLeftOverTempDirectories({ tempFolder, pid: 300, isRunning: (pid) => pid === 200 });

    expect((await readdir(tempFolder)).sort()).toEqual(['uvcs-123456', 'uvcs-200-d4E5f6', 'uvcs-300-g7H8i9', 'uvcs-rev-j1K2l3', 'uvcs-revisions-100-m4N5o6']);
  });
});
