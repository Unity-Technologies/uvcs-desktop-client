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

  it("left over are told by their own names, never the downloads' folders", async () => {
    const tempFolder = await mkdtemp(join(tmpdir(), 'left-over-'));
    for (const name of ['uvcs-100-a1B2c3', 'uvcs-revisions-100-d4E5f6']) await mkdir(join(tempFolder, name));
    await removeLeftOverTempDirectories({ tempFolder, pid: 300, isRunning: () => false });
    expect(await readdir(tempFolder)).toEqual(['uvcs-revisions-100-d4E5f6']);
  });
});
