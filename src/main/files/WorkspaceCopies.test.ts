import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ListedTreeItem } from '../cm/treeItemsXml';
import { contentHashOf, revisionFilesOf, WorkspaceCopies, type RevisionFile } from './WorkspaceCopies';

const hashOf = (text: string) => contentHashOf(Buffer.from(text));

async function workspaceWith(files: Record<string, string>): Promise<string> {
  const workspace = await mkdtemp(join(tmpdir(), 'copies-wk-'));
  for (const [path, text] of Object.entries(files)) {
    const absolutePath = join(workspace, ...path.split('/'));
    await mkdir(join(absolutePath, '..'), { recursive: true });
    await writeFile(absolutePath, text);
  }
  return workspace;
}

const revisionOf = (path: string, text: string | null, size = text?.length ?? -1): RevisionFile => ({
  path,
  revision: { revisionId: 186, repository: 'models@local' },
  hash: text === null ? null : hashOf(text),
  size,
});

describe('WorkspaceCopies.read', () => {
  it("reads the workspace's file when it has the revision's size and MD5", async () => {
    const workspace = await workspaceWith({ 'Prop - Pumpkin/Pumpkin.obj': 'v 0 0 0\n' });

    const read = await new WorkspaceCopies().read(workspace, revisionOf('Prop - Pumpkin/Pumpkin.obj', 'v 0 0 0\n'));

    expect(read?.toString()).toBe('v 0 0 0\n');
  });

  it('reads nothing where the file has other content: changed, of another size, or of the same size', async () => {
    const workspace = await workspaceWith({ 'a.obj': 'v 1 1 1\n', 'b.obj': 'v 0 0 0 and more\n' });
    const copies = new WorkspaceCopies();

    expect(await copies.read(workspace, revisionOf('a.obj', 'v 0 0 0\n'))).toBeNull();
    expect(await copies.read(workspace, revisionOf('b.obj', 'v 0 0 0\n'))).toBeNull();
  });

  it("reads nothing where the file isn't there, is a folder, or the revision's hash isn't known", async () => {
    const workspace = await workspaceWith({ 'Folder/a.obj': 'v\n' });
    const copies = new WorkspaceCopies();

    expect(await copies.read(workspace, revisionOf('gone.obj', 'v\n'))).toBeNull();
    expect(await copies.read(workspace, revisionOf('Folder', 'v\n', -1))).toBeNull();
    expect(await copies.read(workspace, revisionOf('Folder/a.obj', null))).toBeNull();
  });

  it('notices a file written again since it was hashed', async () => {
    const workspace = await workspaceWith({ 'a.obj': 'v 0 0 0\n' });
    const copies = new WorkspaceCopies();
    expect(await copies.read(workspace, revisionOf('a.obj', 'v 0 0 0\n'))).not.toBeNull();

    await writeFile(join(workspace, 'a.obj'), 'v 9 9 9\n');

    expect(await copies.read(workspace, revisionOf('a.obj', 'v 0 0 0\n'))).toBeNull();
  });

  it('refuses a path that leads out of the workspace', async () => {
    const workspace = await workspaceWith({});

    await expect(new WorkspaceCopies().read(workspace, revisionOf('../outside.obj', 'v\n'))).rejects.toThrow('outside the workspace');
  });
});

describe('WorkspaceCopies.remember', () => {
  it('keeps the latest revisions listed, letting the oldest go past its bound', async () => {
    const workspace = await workspaceWith({ 'a.obj': 'a\n', 'b.obj': 'b\n', 'c.obj': 'c\n' });
    const copies = new WorkspaceCopies({ maxListed: 2 });
    const listed = (path: string, revisionId: number): RevisionFile => ({ path, revision: { revisionId, repository: 'models@local' }, hash: hashOf(`${path[0]}\n`), size: 2 });

    copies.remember(workspace, [listed('a.obj', 1), listed('b.obj', 2)]);
    copies.remember(workspace, [listed('a.obj', 1), listed('c.obj', 3)]);

    const read = async (revisionId: number) => (await copies.readRevision(workspace, { revisionId, repository: 'models@local' }))?.toString();
    expect([await read(1), await read(2), await read(3)]).toEqual(['a\n', undefined, 'c\n']);
  });
});

describe('revisionFilesOf', () => {
  const item = (path: string, parts: Partial<ListedTreeItem>): ListedTreeItem => ({
    path, name: path, itemType: 'file', size: 2, date: '', isPrivate: false, isCheckedOut: false, changeset: 3, branch: '/main', owner: 'ana',
    revisionId: 40, parentRevisionId: 30, repository: 'models@local', itemId: 7, hash: 'aGFzaA==', ...parts,
  });

  it('takes the files that hold a revision: never a folder, an xlink, a link, a private item or a checkout', () => {
    const files = revisionFilesOf([
      item('a.cs', {}),
      item('art.png', { itemType: 'binaryFile', revisionId: 41 }),
      item('src', { itemType: 'directory' }),
      item('lib', { itemType: 'xlink' }),
      item('link', { itemType: 'symlink' }),
      item('notes.txt', { isPrivate: true, revisionId: -1, hash: undefined }),
      item('b.cs', { isCheckedOut: true, revisionId: -1 }),
    ]);

    expect(files).toEqual([
      { path: 'a.cs', revision: { revisionId: 40, repository: 'models@local' }, hash: 'aGFzaA==', size: 2 },
      { path: 'art.png', revision: { revisionId: 41, repository: 'models@local' }, hash: 'aGFzaA==', size: 2 },
    ]);
  });
});
