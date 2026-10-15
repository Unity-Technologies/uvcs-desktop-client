import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatOutput } from '../cm/testing/cmOutput';
import { cmFails, fakeCmClient, type CmAnswer } from '../cm/testing/fakeCmClient';
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

describe("WorkspaceCopies.read of a revision whose hash the reader doesn't know: the workspace's revision at its path", () => {
  const OBJ = 'v 0 0 0\n';
  const MTL = 'newmtl Skin\n';
  /** `cm ls <folder> --format=…` of the workspace's `Prop` folder, as cm prints it. */
  const PROP = formatOutput(
    ['Prop', 'dir', 131, 'ZGly', 0, 'rep:3dtest/models@MyOrg@unity'],
    ['Prop/Pumpkin.obj', 'txt', 186, hashOf(OBJ), OBJ.length, 'rep:3dtest/models@MyOrg@unity'],
    ['Prop/PumpkinMaterials.mtl', 'txt', 185, hashOf(MTL), MTL.length, 'rep:3dtest/models@MyOrg@unity'],
  );
  const asked = (path: string, revisionId: number, repository = '3dtest/models@1375488836673@cloud'): RevisionFile => ({ path, revision: { revisionId, repository }, hash: null, size: -1 });

  async function setUp(ls: CmAnswer = PROP, disk: Record<string, string> = { 'Prop/Pumpkin.obj': OBJ, 'Prop/PumpkinMaterials.mtl': MTL }) {
    const workspace = await workspaceWith(disk);
    const fake = fakeCmClient({ ls });
    return { workspace, fake, copies: new WorkspaceCopies({ cm: fake.cm }) };
  }

  it('reads the disk where the workspace holds that revision unchanged, the folder listed once for all its files', async () => {
    const { workspace, fake, copies } = await setUp();

    expect((await copies.read(workspace, asked('Prop/Pumpkin.obj', 186)))?.toString()).toBe(OBJ);
    expect((await copies.read(workspace, asked('/Prop/PumpkinMaterials.mtl', 185)))?.toString()).toBe(MTL);
    expect(fake.commands.map(({ via, args }) => [via, args[0], args[1]])).toEqual([['query', 'ls', join(workspace, 'Prop')]]);
  });

  it('matches the repository by its name, however its server is spelled (a cloud repository has two spellings)', async () => {
    const { workspace, copies } = await setUp();

    expect(await copies.read(workspace, asked('Prop/Pumpkin.obj', 186, '3dtest/models@MyOrg@unity'))).not.toBeNull();
    expect(await copies.read(workspace, asked('Prop/Pumpkin.obj', 186, '3dtest/models@1375488836673@cloud'))).not.toBeNull();
  });

  it("reads nothing where the workspace holds another revision, another repository's (an xlink's), or a changed file", async () => {
    const { workspace, copies } = await setUp(PROP, { 'Prop/Pumpkin.obj': OBJ, 'Prop/PumpkinMaterials.mtl': 'newmtl Edited\n' });

    expect(await copies.read(workspace, asked('Prop/Pumpkin.obj', 182))).toBeNull();
    expect(await copies.read(workspace, asked('Prop/Pumpkin.obj', 186, 'art@local'))).toBeNull();
    expect(await copies.read(workspace, asked('Prop/PumpkinMaterials.mtl', 185))).toBeNull();
  });

  it('reads nothing where the workspace has no such folder, asking once', async () => {
    const { workspace, fake, copies } = await setUp(cmFails('Error: The item /work/Gone is not in the workspace.'));

    expect(await copies.read(workspace, asked('Gone/a.obj', 7))).toBeNull();
    expect(await copies.read(workspace, asked('Gone/b.obj', 8))).toBeNull();
    expect(fake.lines()).toHaveLength(1);
  });

  it('lists the folder again once the workspace changed', async () => {
    const { workspace, fake, copies } = await setUp();
    await copies.read(workspace, asked('Prop/Pumpkin.obj', 186));

    copies.forgetListings(workspace);
    await copies.read(workspace, asked('Prop/Pumpkin.obj', 186));

    expect(fake.lines()).toHaveLength(2);
  });

  it('finds a name the reader writes composed where cm lists it decomposed (macOS)', async () => {
    const name = 'Prop/Calabaza\u0301.obj';
    const { workspace, copies } = await setUp(formatOutput([name, 'txt', 9, hashOf(OBJ), OBJ.length, 'rep:models@local']), { [name.normalize('NFC')]: OBJ });

    expect(await copies.read(workspace, asked(name.normalize('NFC'), 9, 'models@local'))).not.toBeNull();
  });

  it('asks nothing for a path that leads out of the workspace, or without a cm', async () => {
    const { workspace, fake, copies } = await setUp();

    expect(await copies.read(workspace, asked('../Prop/Pumpkin.obj', 186))).toBeNull();
    expect(await new WorkspaceCopies().read(workspace, asked('Prop/Pumpkin.obj', 186))).toBeNull();
    expect(fake.lines()).toEqual([]);
  });
});
