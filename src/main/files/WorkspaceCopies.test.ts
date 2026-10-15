import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatOutput } from '../cm/testing/cmOutput';
import { cmFails, fakeCmClient, type CmAnswer } from '../cm/testing/fakeCmClient';
import type { WorkspaceChange } from '@shared/domain/workspaceChange';
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

    const asked = (path: string, revisionId: number): RevisionFile => ({ path, revision: { revisionId, repository: 'models@local' }, hash: null, size: -1 });
    const read = async (path: string, revisionId: number) => (await copies.read(workspace, asked(path, revisionId)))?.toString();
    expect([await read('a.obj', 1), await read('b.obj', 2), await read('c.obj', 3)]).toEqual(['a\n', undefined, 'c\n']);
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
  const asked = (path: string, revisionId: number, repository = '3dtest/models@MyOrg@unity'): RevisionFile => ({ path, revision: { revisionId, repository }, hash: null, size: -1 });

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

  it("matches a Unity organization's repository by its whole spec, and downloads one named by the organization's id (cm history --xml's, where cm couldn't name it)", async () => {
    const { workspace, copies } = await setUp();

    expect(await copies.read(workspace, asked('Prop/Pumpkin.obj', 186, '3dtest/models@MyOrg@unity'))).not.toBeNull();
    expect(await copies.read(workspace, asked('Prop/Pumpkin.obj', 186, '3dtest/models@1375488836673@cloud'))).toBeNull();
  });

  it("never takes a same-named repository of another server for the workspace's: its revision ids are its own", async () => {
    const onServerA = formatOutput(['Prop/Pumpkin.obj', 'txt', 186, hashOf(OBJ), OBJ.length, 'rep:game@serverA:8087']);
    const { workspace, copies } = await setUp(onServerA);

    expect(await copies.read(workspace, asked('Prop/Pumpkin.obj', 186, 'game@serverB:8087'))).toBeNull();
    expect(await copies.read(workspace, asked('Prop/Pumpkin.obj', 186, 'game@serverA:8087'))).not.toBeNull();
  });

  it("answers a path whose revision the workspace told with no command, and asks the workspace where only another tree's listing named one", async () => {
    const { workspace, fake, copies } = await setUp();
    copies.rememberHeld(workspace, [{ path: 'Prop/Pumpkin.obj', revision: { revisionId: 186, repository: '3dtest/models@MyOrg@unity' }, hash: hashOf(OBJ), size: OBJ.length }]);
    copies.remember(workspace, [{ path: 'Prop/PumpkinMaterials.mtl', revision: { revisionId: 132, repository: '3dtest/models@MyOrg@unity' }, hash: hashOf('old'), size: 3 }]);

    expect(await copies.read(workspace, asked('Prop/Pumpkin.obj', 182))).toBeNull();
    expect(fake.lines()).toEqual([]);
    expect(await copies.read(workspace, asked('Prop/PumpkinMaterials.mtl', 185))).not.toBeNull();
    expect(fake.lines()).toHaveLength(1);
  });

  it("never takes a revision a listing named in a same-named repository of another server", async () => {
    const workspace = await workspaceWith({ 'Prop/Pumpkin.obj': OBJ });
    const copies = new WorkspaceCopies();
    copies.remember(workspace, [{ path: 'Prop/Pumpkin.obj', revision: { revisionId: 186, repository: 'game@serverA:8087' }, hash: hashOf(OBJ), size: OBJ.length }]);

    expect(await copies.read(workspace, asked('Prop/Pumpkin.obj', 186, 'game@serverB:8087'))).toBeNull();
  });

  it("reads nothing where the workspace holds another revision, another repository's (an xlink's), or a changed file", async () => {
    const { workspace, copies } = await setUp(PROP, { 'Prop/Pumpkin.obj': OBJ, 'Prop/PumpkinMaterials.mtl': 'newmtl Edited\n' });

    expect(await copies.read(workspace, asked('Prop/Pumpkin.obj', 182))).toBeNull();
    expect(await copies.read(workspace, asked('Prop/Pumpkin.obj', 186, 'art@local'))).toBeNull();
    expect(await copies.read(workspace, asked('Prop/PumpkinMaterials.mtl', 185))).toBeNull();
  });

  it("asks nothing where the disk has no file at the path: there's no copy to tell", async () => {
    const { workspace, fake, copies } = await setUp(PROP, {});

    expect(await copies.read(workspace, asked('Prop/Pumpkin.obj', 186))).toBeNull();
    expect(fake.lines()).toEqual([]);
  });

  it("reads nothing where the workspace can't list the folder (files it doesn't control), asking once", async () => {
    const { workspace, fake, copies } = await setUp(cmFails('Error: The item /work/Private is not in the workspace.'), { 'Private/a.obj': OBJ, 'Private/b.obj': OBJ });

    expect(await copies.read(workspace, asked('Private/a.obj', 7))).toBeNull();
    expect(await copies.read(workspace, asked('Private/b.obj', 8))).toBeNull();
    expect(fake.lines()).toHaveLength(1);
  });

  it('lists the folder again for a revision it never named once the workspace changed (an update loaded another)', async () => {
    const { workspace, fake, copies } = await setUp();
    await copies.read(workspace, asked('Prop/Pumpkin.obj', 186));
    await copies.read(workspace, asked('Prop/Pumpkin.obj', 190));
    expect(fake.lines()).toHaveLength(1);

    copies.forgetListings(workspace);
    await copies.read(workspace, asked('Prop/Pumpkin.obj', 190));

    expect(fake.lines()).toHaveLength(2);
  });

  describe('as the workspace changes', () => {
    const change = (parts: Partial<WorkspaceChange>): WorkspaceChange => ({ content: true, pathsChanged: false, metadata: false, folders: [], ...parts });
    /** Lists `Prop` (asked for a revision it doesn't hold), lets the change in, and tells whether asking again lists it again. */
    async function listsAgainAfter(seen: WorkspaceChange): Promise<boolean> {
      const { workspace, fake, copies } = await setUp();
      await copies.read(workspace, asked('Prop/Pumpkin.obj', 190));
      copies.forgetChanged(workspace, seen);
      await copies.read(workspace, asked('Prop/Pumpkin.obj', 190));
      return fake.lines().length === 2;
    }

    it("takes nothing as held from a listing that was under way as the workspace changed: it tells the state before", async () => {
      const workspace = await workspaceWith({ 'Prop/Pumpkin.obj': OBJ });
      /** Each `cm ls` asked, answered when the test says. */
      const listings: { answer: (output: string) => void }[] = [];
      let onListing = (): void => undefined;
      const fake = fakeCmClient({ ls: () => new Promise<string>((answer) => (listings.push({ answer }), onListing())) });
      const nextListing = () => new Promise<void>((resolve) => (onListing = resolve));
      const copies = new WorkspaceCopies({ cm: fake.cm });

      const listed = nextListing();
      const reading = copies.read(workspace, asked('Prop/Pumpkin.obj', 186));
      await listed;
      copies.forgetChanged(workspace, change({ metadata: true }));
      listings[0]!.answer(PROP);
      // The listing's hashes still serve the revisions it named, checked against the disk.
      expect(await reading).not.toBeNull();

      const listedAgain = nextListing();
      const second = copies.read(workspace, asked('Prop/Pumpkin.obj', 190));
      await listedAgain;
      listings[1]!.answer(PROP);
      expect(await second).toBeNull();
      expect(fake.lines()).toHaveLength(2);
    });

    it("takes nothing as held from a history's cm ls that was under way as the workspace changed", async () => {
      const { workspace, fake, copies } = await setUp();
      const before = copies.generationOf(workspace);
      copies.forgetChanged(workspace, change({ metadata: true }));

      copies.rememberHeld(workspace, [{ path: 'Prop/Pumpkin.obj', revision: { revisionId: 186, repository: '3dtest/models@MyOrg@unity' }, hash: hashOf(OBJ), size: OBJ.length }], before);
      await copies.read(workspace, asked('Prop/Pumpkin.obj', 190));

      expect(fake.lines()).toHaveLength(1);
    });

    it("keeps a folder's listing while only other folders' files change (an editor writing elsewhere)", async () => {
      expect(await listsAgainAfter(change({ folders: ['Library', 'Assets/Scenes'] }))).toBe(false);
    });

    it('lists a folder again once its own files changed', async () => {
      expect(await listsAgainAfter(change({ folders: ['Prop'] }))).toBe(true);
    });

    it("lists every folder again once cm rewrote the workspace's state (an update, a checkin, an undo)", async () => {
      expect(await listsAgainAfter(change({ metadata: true, folders: ['Library'] }))).toBe(true);
    });

    it("lists every folder again when the watcher couldn't tell which changed", async () => {
      expect(await listsAgainAfter(change({ folders: null }))).toBe(true);
    });
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
