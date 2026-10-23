import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SessionFolder } from './SessionFolder';

async function inTemp() {
  return mkdtemp(join(tmpdir(), 'session-folder-'));
}

describe('SessionFolder', () => {
  it('is made once, named after its prefix and this process, the first time it is asked for', async () => {
    const tempFolder = await inTemp();
    const folder = new SessionFolder({ prefix: 'uvcs-trees-', tempFolder, pid: 100, isRunning: () => false });

    const [first, second] = await Promise.all([folder.path(), folder.path()]);
    expect(first).toBe(second);
    expect(first.startsWith(join(tempFolder, 'uvcs-trees-100-'))).toBe(true);
    expect(existsSync(first)).toBe(true);
  });

  it("deletes what crashed sessions left first, never a running app's nor another prefix's", async () => {
    const tempFolder = await inTemp();
    for (const name of ['uvcs-trees-200-a', 'uvcs-trees-300-b', 'uvcs-revisions-200-c']) await mkdir(join(tempFolder, name));
    const folder = new SessionFolder({ prefix: 'uvcs-trees-', tempFolder, pid: 100, isRunning: (pid) => pid === 300 });

    const made = await folder.path();
    expect((await readdir(tempFolder)).sort()).toEqual(['uvcs-revisions-200-c', 'uvcs-trees-300-b', made.slice(tempFolder.length + 1)].sort());
  });

  it('is deleted as the app quits, and quitting never fails for a folder Windows holds', async () => {
    const folder = new SessionFolder({ prefix: 'uvcs-trees-', tempFolder: await inTemp(), pid: 100, isRunning: () => false });
    const made = await folder.path();
    folder.dispose();
    expect(existsSync(made)).toBe(false);

    const held = new SessionFolder({ prefix: 'uvcs-trees-', tempFolder: await inTemp(), pid: 100, isRunning: () => false, removeFolder: () => { throw new Error('EBUSY'); } });
    await held.path();
    expect(() => held.dispose()).not.toThrow();
  });

  it('deletes nothing when it was never made', () => {
    const removed: string[] = [];
    new SessionFolder({ prefix: 'uvcs-trees-', removeFolder: (made) => void removed.push(made) }).dispose();
    expect(removed).toEqual([]);
  });
});
