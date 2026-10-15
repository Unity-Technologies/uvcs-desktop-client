import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatOutput, treeListingOutput, workspaceListingXml } from '../cm/testing/cmOutput';
import { cmFails, fakeCmClient, optionValue, type CmAnswer, type FakeCmCommand } from '../cm/testing/fakeCmClient';
import { contentHashOf } from '../files/WorkspaceCopies';
import type { ReviewStore } from '../review/ReviewStore';
import { createContentService } from './contentService';
import { createExplorerService } from './explorerService';
import { serviceContext } from './testing/serviceContext';

async function newWorkspace(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'content-wk-'));
}

function content(answers: Record<string, CmAnswer>, reviews?: Partial<ReviewStore>) {
  const fake = fakeCmClient(answers);
  return { ...fake, service: createContentService(serviceContext(fake.cm, { reviews: reviews as ReviewStore })) };
}

/** A `cm cat` that writes `text` to the file it is given, remembering which. */
function catWriting(text: string) {
  const written: string[] = [];
  const answer = async ({ args }: FakeCmCommand): Promise<string> => {
    const file = optionValue(args, '--file=')!;
    written.push(file);
    await writeFile(file, text, 'utf8');
    return '';
  };
  return { written, answer };
}

/** `/Assets` at a point: a glTF, its `.bin` and its `.meta`. */
const ASSETS_LISTING = treeListingOutput(
  { path: 'Assets', type: 'dir', revid: 40 },
  { path: 'Assets/Barrel.bin', revid: 41 },
  { path: 'Assets/Barrel.gltf.meta', type: 'txt', revid: 42 },
  { path: 'Assets/Barrel.gltf', type: 'txt', revid: 43 },
);

const LS_UNDER_XLINK = `<?xml version="1.0" encoding="utf-8"?>
<LsResults><LsItems>
  <LsItem><Status>Controlled</Status><Name>a.cs</Name><WkPath>/lib/a.cs</WkPath><Size>12</Size><Type>txt</Type>
    <Changeset>30</Changeset><Repository>rep:lib@local</Repository><RevId>432</RevId><ParentRevId>400</ParentRevId><ItemId>9</ItemId>
    <Branch>/main</Branch><Date>2026-09-25T09:41:47+02:00</Date></LsItem>
</LsItems></LsResults>`;

describe('reading content', () => {
  it('reads a revision with one quick cm cat into a temp file, deleted afterwards', async () => {
    const workspace = await newWorkspace();
    const { written, answer } = catWriting('class Player {}\n');
    const { service, commands } = content({ cat: answer });

    const read = await service.read(workspace, { kind: 'revision', revision: { revisionId: 45, repository: 'game@local' }, fileName: 'player.cs' });

    expect(read).toMatchObject({ text: 'class Player {}\n', isBinary: false });
    expect(commands).toMatchObject([{ via: 'query', args: ['cat', 'revid:45@game@local', `--file=${written[0]}`], options: { cwd: workspace } }]);
    expect(existsSync(written[0]!)).toBe(false);
  });

  it('reads a file under an xlink from the changeset tree, with a second command only when its repository path finds nothing', async () => {
    const workspace = await newWorkspace();
    const { answer } = catWriting('xlinked\n');
    const { service, commands } = content({
      cat: (command) => (command.args[1]!.startsWith('serverpath:') ? cmFails('Error: The specified item /lib/a.cs does not exist.') : answer(command)),
      ls: LS_UNDER_XLINK,
    });

    const read = await service.read(workspace, { kind: 'repositoryPath', path: '/lib/a.cs', at: 'cs:30' });

    expect(read.text).toBe('xlinked\n');
    expect(commands.map(({ args }) => args.filter((arg) => !arg.startsWith('--file=')))).toEqual([
      ['cat', 'serverpath:/lib/a.cs#cs:30'],
      ['ls', '/lib/a.cs', '--tree=cs:30', '--xml'],
      ['cat', 'revid:432@lib@local'],
    ]);
  });

  it('reads workspace files from disk and the empty side without asking cm', async () => {
    const workspace = await newWorkspace();
    await mkdir(join(workspace, 'src'));
    await writeFile(join(workspace, 'src', 'a.cs'), 'local edit\n');
    const { service, commands } = content({});

    expect((await service.read(workspace, { kind: 'workspaceFile', path: 'src/a.cs' })).text).toBe('local edit\n');
    expect(await service.read(workspace, { kind: 'empty' })).toEqual({ text: '', isBinary: false, size: 0 });
    expect(commands).toEqual([]);
  });

  it('reads the reviewed copy of a file from the review store', async () => {
    const snapshot = { text: 'reviewed\n', isBinary: false, size: 9 };
    const { service, commands } = content({}, { readSnapshot: async () => snapshot });

    expect(await service.read('wk', { kind: 'reviewSnapshot', path: 'a.cs' })).toBe(snapshot);
    expect(commands).toEqual([]);
  });
});

describe('writing a workspace file', () => {
  it('writes the text as the editor has it, line breaks included', async () => {
    const workspace = await newWorkspace();
    await writeFile(join(workspace, 'a.cs'), 'old\n');
    const { service } = content({});

    await service.writeWorkspaceFile(workspace, 'a.cs', 'new\r\nlines\r\n');

    expect(await readFile(join(workspace, 'a.cs'), 'utf8')).toBe('new\r\nlines\r\n');
  });
});

describe('reading the bytes of a model companion', () => {
  it("reads a glTF's .bin beside it in the workspace, from the disk", async () => {
    const workspace = await newWorkspace();
    await mkdir(join(workspace, 'Assets'), { recursive: true });
    await writeFile(join(workspace, 'Assets', 'Barrel.bin'), Buffer.from([1, 2, 3]));
    const { service, commands } = content({});

    expect([...(await service.readBytes(workspace, { kind: 'workspaceFile', path: 'Assets/Barrel.bin' }))!]).toEqual([1, 2, 3]);
    expect(commands).toEqual([]);
  });

  it("reads one at a changeset or branch head by its revision there, from its folder's listing, which its other companions share", async () => {
    const workspace = await newWorkspace();
    const { written, answer } = catWriting('BIN');
    const { service, commands } = content({ cat: answer, ls: ASSETS_LISTING });

    const bytes = await service.readBytes(workspace, { kind: 'repositoryPath', path: '/Assets/Barrel.bin', at: 'cs:12' });
    await service.readBytes(workspace, { kind: 'repositoryPath', path: '/Assets/Barrel.gltf.meta', at: 'cs:12' });

    expect(new TextDecoder().decode(bytes!)).toBe('BIN');
    expect(commands.map(({ via, args }) => [via, args[0], args[1]])).toEqual([
      // Its children alone, never the subtree: a model in a big folder lists only that folder.
      ['query', 'ls', '/Assets'],
      ['query', 'cat', 'revid:41@eco@local'],
      ['query', 'cat', 'revid:42@eco@local'],
    ]);
    expect(written).toHaveLength(2);
  });

  describe('beside a revision of the model (a History, named at the path it was opened at)', () => {
    /** `cm ls <folder> --tree` as cm answers each folder at the point; a folder the tree hasn't fails as cm does. */
    const listings = (folders: Record<string, string>) => async ({ args }: FakeCmCommand) =>
      folders[args[1]!] ?? cmFails([`Can't resolve the selector for the item ${args[1]}`, '<?xml version="1.0" encoding="utf-8"?>', '<LsResults>', '  <LsItems />', '</LsResults>'].join('\n'));
    const BUFFERS_LISTING = treeListingOutput({ path: 'Assets/buffers', type: 'dir', revid: 50 }, { path: 'Assets/buffers/Box.bin', revid: 51 });
    const ls = listings({ '/Assets': ASSETS_LISTING, '/Assets/buffers': BUFFERS_LISTING });
    const binBeside = (revisionId: number) => ({ kind: 'repositoryPath' as const, path: '/Assets/Barrel.bin', at: 'cs:12', beside: { path: '/Assets/Barrel.gltf', revisionId } });

    it('reads it where the listing has the model at its path as that revision, from the same listing', async () => {
      const workspace = await newWorkspace();
      const { written, answer } = catWriting('BIN');
      const { service, commands } = content({ cat: answer, ls });

      expect(new TextDecoder().decode((await service.readBytes(workspace, binBeside(43)))!)).toBe('BIN');
      expect(commands.map(({ via, args }) => [via, args[0], args[1]])).toEqual([
        ['query', 'ls', '/Assets'],
        ['query', 'cat', 'revid:41@eco@local'],
      ]);
      expect(written).toHaveLength(1);
    });

    it("reads one in a folder below the model's by its revision in that folder's listing, the model checked in its own", async () => {
      const workspace = await newWorkspace();
      const { answer } = catWriting('BIN');
      const { service, commands } = content({ cat: answer, ls });
      const bin = { kind: 'repositoryPath' as const, path: '/Assets/buffers/Box.bin', at: 'cs:12', beside: { path: '/Assets/Barrel.gltf', revisionId: 43 } };

      expect(await service.readBytes(workspace, bin)).not.toBeNull();
      expect(commands.map(({ via, args }) => [via, args[0], args[1]])).toEqual([
        ['query', 'ls', '/Assets'],
        ['query', 'ls', '/Assets/buffers'],
        ['query', 'cat', 'revid:51@eco@local'],
      ]);
    });

    it("reads it as nothing where another item, or none, was at the model's path then (moved or renamed since, its folder gone), with no cm cat", async () => {
      const workspace = await newWorkspace();
      const { service, lines } = content({ ls });

      expect(await service.readBytes(workspace, binBeside(7))).toBeNull();
      expect(await service.readBytes(workspace, { ...binBeside(43), beside: { path: '/Assets/Old/Barrel.gltf', revisionId: 43 } })).toBeNull();
      expect(lines().map((line) => line.split(' --format')[0])).toEqual(['ls /Assets --tree=cs:12', 'ls /Assets/Old --tree=cs:12']);
    });

    it("reads a .meta's model by its revision in the listing, and as no model where the .meta wasn't there then: an answer, not a failure", async () => {
      const workspace = await newWorkspace();
      const { answer } = catWriting('glTF');
      const { service, lines } = content({ cat: answer, ls });
      const model = (revisionId: number, metaFolder = 'Assets') => ({ kind: 'repositoryPath' as const, path: '/Assets/Barrel.gltf', at: 'cs:12', beside: { path: `/${metaFolder}/Barrel.gltf.meta`, revisionId } });

      expect((await service.read(workspace, model(42))).text).toBe('glTF');
      expect(await service.read(workspace, model(5))).toEqual({ text: '', isBinary: false, size: 0 });
      expect(await service.read(workspace, model(42, 'Renamed'))).toEqual({ text: '', isBinary: false, size: 0 });
      expect(lines().map((line) => line.split(' --f')[0])).toEqual(['ls /Assets --tree=cs:12', 'cat revid:43@eco@local', 'ls /Renamed --tree=cs:12']);
    });
  });

  it("reads a companion that isn't there as nothing, from the disk or from the tree's listing, without a failing command", async () => {
    const workspace = await newWorkspace();
    const { service, lines } = content({ ls: ASSETS_LISTING });
    expect(await service.readBytes(workspace, { kind: 'workspaceFile', path: 'Assets/Hero.fbx.meta' })).toBeNull();
    expect(await service.readBytes(workspace, { kind: 'repositoryPath', path: '/Assets/Hero.fbx.meta', at: 'cs:4' })).toBeNull();
    expect(await service.readBytes(workspace, { kind: 'repositoryPath', path: '/Assets/Shared/Hero.fbx.meta', at: 'cs:4', repository: 'art@local' })).toBeNull();
    expect(lines().map((line) => line.split(' --format')[0])).toEqual(['ls /Assets --tree=cs:4', 'ls /Assets/Shared --tree=cs:4']);
  });

  it('reads a companion under an xlink by its revision in the xlinked repository, as the listing names it', async () => {
    const { answer } = catWriting('META');
    const { service, lines } = content({ cat: answer, ls: treeListingOutput({ path: 'Assets/Shared', type: 'xlink', revid: 3 }, { path: 'Assets/Shared/Hero.fbx.meta', type: 'txt', revid: 77, repository: 'art@local' }) });
    expect(await service.readBytes(await newWorkspace(), { kind: 'repositoryPath', path: '/Assets/Shared/Hero.fbx.meta', at: 'cs:3', repository: 'art@local' })).not.toBeNull();
    expect(lines()[1]).toMatch(/^cat revid:77@art@local --file=/);
  });

  describe("of the workspace's repository that isn't there", () => {
    /** As cm prints it: `serverpath:` can't tell a missing file from one under an xlink, so the tree is asked. */
    const notFound = ({ args }: FakeCmCommand) => cmFails(`The specified revision was not found ${args[1]}`);
    const notInTree = ({ args }: FakeCmCommand) =>
      cmFails([`Can't resolve the selector for the item ${args[1]}`, '<?xml version="1.0" encoding="utf-8"?>', '<LsResults>', '  <LsItems />', '</LsResults>'].join('\n'));

    it.each(['cs:3', 'br:/main'])('reads it as nothing at %s, where the tree has no such folder', async (at) => {
      const { service, lines } = content({ cat: notFound, ls: notInTree });
      expect(await service.readBytes(await newWorkspace(), { kind: 'repositoryPath', path: '/Assets/Crate.fbx.meta', at })).toBeNull();
      expect(lines().map((line) => line.split(' --format')[0])).toEqual([`ls /Assets --tree=${at}`]);
    });

    it.each(['sh:2', 'lb:v1.0'])("reads it as nothing at %s, whose tree cm ls can't list, from its one failing cm cat", async (at) => {
      const { service, lines } = content({ cat: notFound });
      expect(await service.readBytes(await newWorkspace(), { kind: 'repositoryPath', path: '/Assets/Crate.fbx.meta', at })).toBeNull();
      expect(lines()).toHaveLength(1);
    });

    it("fails when the tree can't be asked: the file may well be there", async () => {
      const { service } = content({ cat: notFound, ls: cmFails('Error: The server is unreachable.') });
      await expect(service.readBytes(await newWorkspace(), { kind: 'repositoryPath', path: '/Assets/Crate.fbx.meta', at: 'cs:3' })).rejects.toThrow();
    });

    it.each(['The specified changeset cs:9 does not exist.', 'Specified branch /main/old does not exist'])(
      'fails when the tree tells the point is gone (%s), which says nothing of the file',
      async (gone) => {
        const { service } = content({ cat: notFound, ls: cmFails(gone) });
        await expect(service.readBytes(await newWorkspace(), { kind: 'repositoryPath', path: '/Assets/Crate.fbx.meta', at: 'cs:9' })).rejects.toThrow();
        await expect(service.readBytes(await newWorkspace(), { kind: 'repositoryPath', path: '/Assets/Shared/Crate.fbx.meta', at: 'cs:9', repository: 'art@local' })).rejects.toThrow();
      },
    );

    it('fails for a revision not found, which names one that should be there', async () => {
      const { service } = content({ cat: ({ args }) => cmFails(`The specified revision was not found ${args[1]}`) });
      await expect(service.readBytes(await newWorkspace(), { kind: 'revision', revision: { revisionId: 4, repository: 'game@local' }, fileName: 'a.bin' })).rejects.toThrow('not found');
    });
  });

  it('fails on any other error, which is no answer about the file', async () => {
    const { service } = content({ cat: () => cmFails('Error: The server is unreachable.') });
    await expect(service.readBytes(await newWorkspace(), { kind: 'revision', revision: { revisionId: 4, repository: 'game@local' }, fileName: 'a.bin' })).rejects.toThrow('unreachable');
  });

  it('refuses a workspace file outside the workspace', async () => {
    const { service } = content({});
    await expect(service.readBytes(await newWorkspace(), { kind: 'workspaceFile', path: '../../etc/passwd' })).rejects.toThrow('outside the workspace');
    await expect(service.read(await newWorkspace(), { kind: 'workspaceFile', path: '../../etc/passwd' })).rejects.toThrow('outside the workspace');
    await expect(service.writeWorkspaceFile(await newWorkspace(), '../outside.txt', 'x')).rejects.toThrow('outside the workspace');
  });

  it('reads nothing of an empty side', async () => {
    const { service } = content({});
    expect(await service.readBytes(await newWorkspace(), { kind: 'empty' })).toBeNull();
  });
});

describe("reading a revision the workspace's disk holds", () => {
  const PUMPKIN = 'v 0 0 0\nmtllib PumpkinMaterials.mtl\n';
  const MTL = 'newmtl Skin\nmap_Kd Pumpkin_Skin.png\n';
  const md5 = (text: string) => contentHashOf(Buffer.from(text));
  const revision = (revisionId: number, fileName = 'Prop/Pumpkin.obj', repository = 'eco@local') => ({ kind: 'revision' as const, revision: { revisionId, repository }, fileName });

  /** The Files view's listing of `Prop`, as the workspace loaded it, then the content service reading in the same context. */
  async function filesView(listing: string, disk: Record<string, string>) {
    const workspace = await newWorkspace();
    await mkdir(join(workspace, 'Prop'));
    for (const [path, text] of Object.entries(disk)) await writeFile(join(workspace, ...path.split('/')), text);
    const { answer } = catWriting('downloaded');
    const fake = fakeCmClient({ ls: listing, cat: answer });
    const context = serviceContext(fake.cm);
    await createExplorerService(context).listDirectory(workspace, 'Prop');
    return { workspace, fake, service: createContentService(context) };
  }
  const cats = (fake: ReturnType<typeof fakeCmClient>) => fake.lines().filter((line) => line.startsWith('cat ')).map((line) => line.split(' ')[1]);

  const PROP_LISTING = workspaceListingXml(
    'Prop',
    { path: 'Prop/Pumpkin.obj', revid: 186, size: PUMPKIN.length, hash: md5(PUMPKIN) },
    { path: 'Prop/PumpkinMaterials.mtl', revid: 185, size: MTL.length, hash: md5(MTL) },
  );

  it('reads the revisions the listing names from the disk, with no cm cat, where the files there are those revisions', async () => {
    const { workspace, fake, service } = await filesView(PROP_LISTING, { 'Prop/Pumpkin.obj': PUMPKIN, 'Prop/PumpkinMaterials.mtl': MTL });

    expect((await service.read(workspace, revision(186))).text).toBe(PUMPKIN);
    expect(new TextDecoder().decode((await service.readBytes(workspace, revision(185, 'Prop/PumpkinMaterials.mtl')))!)).toBe(MTL);
    expect(fake.lines()).toEqual([`ls ${join(workspace, 'Prop')} --xml --symlink`]);
  });

  it("asks the workspace nothing more for a revision the Files view's listing of its folder doesn't name (the one before)", async () => {
    const { workspace, fake, service } = await filesView(PROP_LISTING, { 'Prop/Pumpkin.obj': PUMPKIN });

    await service.read(workspace, revision(182));

    expect(fake.lines().map((line) => line.split(' ')[0])).toEqual(['ls', 'cat']);
  });

  it('downloads a revision whose file on disk was changed, even to the same size', async () => {
    const { workspace, fake, service } = await filesView(PROP_LISTING, { 'Prop/Pumpkin.obj': PUMPKIN.replace('0 0 0', '1 1 1'), 'Prop/PumpkinMaterials.mtl': `${MTL}# edited\n` });

    expect((await service.read(workspace, revision(186))).text).toBe('downloaded');
    expect((await service.read(workspace, revision(185, 'Prop/PumpkinMaterials.mtl'))).text).toBe('downloaded');
    expect(cats(fake)).toEqual(['revid:186@eco@local', 'revid:185@eco@local']);
  });

  it("downloads a revision whose file isn't on disk (deleted, cloaked, moved away)", async () => {
    const { workspace, fake, service } = await filesView(PROP_LISTING, {});

    expect((await service.read(workspace, revision(186))).text).toBe('downloaded');
    expect(cats(fake)).toEqual(['revid:186@eco@local']);
  });

  it("downloads the file's other revisions, and a checked-out file's: the listing names no revision of a checkout", async () => {
    const checkedOut = workspaceListingXml('Prop', { path: 'Prop/Pumpkin.obj', revid: 186, size: PUMPKIN.length, hash: md5(PUMPKIN), checkedOut: true });
    const { workspace, fake, service } = await filesView(checkedOut, { 'Prop/Pumpkin.obj': PUMPKIN });

    await service.read(workspace, revision(186));
    await service.read(workspace, revision(132));

    expect(cats(fake)).toEqual(['revid:186@eco@local', 'revid:132@eco@local']);
  });

  it("downloads the same revision id of another repository (an xlinked one's)", async () => {
    const { workspace, fake, service } = await filesView(PROP_LISTING, { 'Prop/Pumpkin.obj': PUMPKIN });

    await service.read(workspace, revision(186, 'Prop/Pumpkin.obj', 'art@local'));

    expect(cats(fake)).toEqual(['revid:186@art@local']);
  });

  it('reads a file under an xlink from the disk by its revision in the xlinked repository', async () => {
    const xlinked = workspaceListingXml('Prop', { path: 'Prop/Pumpkin.obj', revid: 9, size: PUMPKIN.length, hash: md5(PUMPKIN), repository: 'art@local' });
    const { workspace, fake, service } = await filesView(xlinked, { 'Prop/Pumpkin.obj': PUMPKIN });

    expect((await service.read(workspace, revision(9, 'Prop/Pumpkin.obj', 'art@local'))).text).toBe(PUMPKIN);
    expect(cats(fake)).toEqual([]);
  });

  it('reads at the path the listing gives with Windows separators', async () => {
    const windows = workspaceListingXml('Prop', { path: 'Prop\\Pumpkin.obj', revid: 186, size: PUMPKIN.length, hash: md5(PUMPKIN) });
    const { workspace, fake, service } = await filesView(windows, { 'Prop/Pumpkin.obj': PUMPKIN });

    expect((await service.read(workspace, revision(186, 'Prop/Pumpkin.obj'))).text).toBe(PUMPKIN);
    expect(cats(fake)).toEqual([]);
  });

  it("reads a revision one workspace's listing named from that workspace's disk only", async () => {
    const { workspace, fake, service } = await filesView(PROP_LISTING, { 'Prop/Pumpkin.obj': PUMPKIN });
    const other = await newWorkspace();
    await mkdir(join(other, 'Prop'));
    await writeFile(join(other, 'Prop', 'Pumpkin.obj'), PUMPKIN);

    await service.read(other, revision(186));
    await service.read(workspace, revision(186));

    expect(cats(fake)).toEqual(['revid:186@eco@local']);
  });

  it("reads a model's sibling at a changeset from the disk where the tree's listing has the disk's content", async () => {
    const workspace = await newWorkspace();
    await mkdir(join(workspace, 'Assets'));
    await writeFile(join(workspace, 'Assets', 'Barrel.bin'), 'BIN');
    const { service, lines } = content({ ls: treeListingOutput({ path: 'Assets', type: 'dir', revid: 40 }, { path: 'Assets/Barrel.bin', revid: 41, size: 3, hash: md5('BIN') }) });

    expect(new TextDecoder().decode((await service.readBytes(workspace, { kind: 'repositoryPath', path: '/Assets/Barrel.bin', at: 'cs:12' }))!)).toBe('BIN');
    expect(lines().map((line) => line.split(' --format')[0])).toEqual(['ls /Assets --tree=cs:12']);
  });
});

describe("reading a committed diff's revisions (a changeset, a branch, a shelve, Incoming)", () => {
  const BEFORE = 'v 0 0 0\n';
  const md5 = (text: string) => contentHashOf(Buffer.from(text));
  /** The workspace's `cm ls <folder> --format=…` of `Prop`, as cm prints it: it holds the diff's side before. */
  const PROP = formatOutput(['Prop', 'dir', 131, 'ZGly', 0, 'rep:game@local'], ['Prop/Pumpkin.obj', 'txt', 182, md5(BEFORE), BEFORE.length, 'rep:game@local']);
  const side = (revisionId: number) => ({ kind: 'revision' as const, revision: { revisionId, repository: 'game@local' }, fileName: 'Prop/Pumpkin.obj' });

  it("reads the side the workspace holds unchanged from its disk, asking the workspace's folder once, and downloads the other", async () => {
    const workspace = await newWorkspace();
    await mkdir(join(workspace, 'Prop'));
    await writeFile(join(workspace, 'Prop', 'Pumpkin.obj'), BEFORE);
    const { answer } = catWriting('after');
    const { service, lines } = content({ ls: PROP, cat: answer });

    expect((await service.read(workspace, side(182))).text).toBe(BEFORE);
    expect((await service.read(workspace, side(186))).text).toBe('after');
    expect(lines().map((line) => line.split(' --f')[0])).toEqual([`ls ${join(workspace, 'Prop')}`, 'cat revid:186@game@local']);
  });

  it('downloads the side the workspace holds once its file changed', async () => {
    const workspace = await newWorkspace();
    await mkdir(join(workspace, 'Prop'));
    await writeFile(join(workspace, 'Prop', 'Pumpkin.obj'), 'v 9 9 9\n');
    const { answer } = catWriting(BEFORE);
    const { service, ran } = content({ ls: PROP, cat: answer });

    expect((await service.read(workspace, side(182))).text).toBe(BEFORE);
    expect(ran('cat revid:182@game@local')).toBe(true);
  });
});
