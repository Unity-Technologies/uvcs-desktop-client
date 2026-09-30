import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { listWorkspacePaths } from './listWorkspacePaths';

async function workspaceWith(files: string[]): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'uvcs-list-'));
  for (const file of files) {
    const path = join(root, ...file.split('/'));
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, '');
  }
  return root;
}

const sorted = (paths: { path: string; isDirectory: boolean }[]) => [...paths].sort((a, b) => a.path.localeCompare(b.path));

describe('listWorkspacePaths', () => {
  it('lists every file and folder with forward slashes, private ones included', async () => {
    const root = await workspaceWith(['README.md', 'src/app.ts', 'src/ui/Button.tsx']);

    expect(sorted(await listWorkspacePaths(root))).toEqual([
      { path: 'README.md', isDirectory: false },
      { path: 'src', isDirectory: true },
      { path: 'src/app.ts', isDirectory: false },
      { path: 'src/ui', isDirectory: true },
      { path: 'src/ui/Button.tsx', isDirectory: false },
    ]);
  });

  it("leaves out the workspace's own .plastic folder and Git's", async () => {
    const root = await workspaceWith(['.plastic/plastic.selector', '.git/HEAD', 'a.txt']);

    expect(await listWorkspacePaths(root)).toEqual([{ path: 'a.txt', isDirectory: false }]);
  });

  it.skipIf(process.platform === 'win32')('lists a link to a folder without following it', async () => {
    const root = await workspaceWith(['src/app.ts']);
    await symlink(join(root, 'src'), join(root, 'linked'));

    expect(sorted(await listWorkspacePaths(root)).map(({ path }) => path)).toEqual(['linked', 'src', 'src/app.ts']);
  });

  it('lists nothing for a folder that is gone', async () => {
    expect(await listWorkspacePaths(join(tmpdir(), 'uvcs-no-such-workspace'))).toEqual([]);
  });
});
