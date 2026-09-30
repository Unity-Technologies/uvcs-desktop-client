import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { describeDraggedFolder } from './draggedFolder';

async function tempFolder(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'dragged-'));
}

describe('describeDraggedFolder', () => {
  it('tells a workspace by its .plastic folder', async () => {
    const workspace = await tempFolder();
    await mkdir(join(workspace, '.plastic'));

    expect(await describeDraggedFolder(workspace)).toEqual({ path: workspace, isWorkspace: true });
  });

  it('tells a folder inside a workspace, however deep', async () => {
    const workspace = await tempFolder();
    await mkdir(join(workspace, '.plastic'));
    const inside = join(workspace, 'Assets', 'Art');
    await mkdir(inside, { recursive: true });

    expect(await describeDraggedFolder(inside)).toEqual({ path: inside, isWorkspace: true });
  });

  it('tells a folder outside any workspace', async () => {
    const folder = await tempFolder();

    expect(await describeDraggedFolder(folder)).toEqual({ path: folder, isWorkspace: false });
  });

  it('is null for a file, a path that is gone, and no path', async () => {
    const folder = await tempFolder();
    const file = join(folder, 'readme.md');
    await writeFile(file, 'x');

    expect(await describeDraggedFolder(file)).toBeNull();
    expect(await describeDraggedFolder(join(folder, 'gone'))).toBeNull();
    expect(await describeDraggedFolder(null)).toBeNull();
  });

  it('does not take a .plastic file for a workspace', async () => {
    const folder = await tempFolder();
    await writeFile(join(folder, '.plastic'), '');

    expect(await describeDraggedFolder(folder)).toEqual({ path: folder, isWorkspace: false });
  });
});
