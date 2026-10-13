import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AssetsPoint, UnityAssetsRequest } from '@shared/domain/unityAssets';
import { cmFails, fakeCmClient, type CmAnswer } from '../cm/testing/fakeCmClient';
import { treeListingOutput, type ListedRecord } from '../cm/testing/cmOutput';
import type { RevisionFile } from '../unity/RevisionDownloads';
import { BRANCH_TREE_LIFE_MS, createUnityAssetsService } from './unityAssetsService';

// The Materials look at a version's point of the repository (`AssetsPoint` `repository`): what `cm ls --tree` lists
// there, never the workspace's disk, whose files may be another revision's or not there at all.

const MAT_GUID = '0f2b6c1e9a8d4b3c8e7f6a5b4c3d2e1f';
const BARK_GUID = '6d1e0c9b8a7f4e3d2c1b0a9f8e7d6c5b';
const BRANCH = 'br:/main/child_1/subtask/123456';
const meta = (guid: string): string => `fileFormatVersion: 2\nguid: ${guid}\nTextureImporter:\n`;

/** The izh-27 glTF of the issue: its images in `textures/` beside it, on a branch the workspace never loaded. */
const GLTF_FOLDER: ListedRecord[] = [
  { path: '3DModels/izh-27', type: 'dir', revid: 29825 },
  { path: '3DModels/izh-27/scene.gltf', type: 'txt', size: 12952, revid: 29681 },
  { path: '3DModels/izh-27/textures', type: 'dir', revid: 29887 },
  { path: '3DModels/izh-27/textures/izh-27_baseColor.png', size: 8714025, revid: 29682, hash: 'gIxTMls7W/6uGzXpdYIprQ==' },
  { path: '3DModels/izh-27/textures/izh-27_normal.png', size: 12670152, revid: 29684 },
];

/** A Unity project whose tree model takes its textures from `Assets/Art/Textures` and a remapped `.mat`. */
const PROJECT: ListedRecord[] = [
  { path: 'Game', type: 'dir', revid: 1 },
  { path: 'Game/Assets', type: 'dir', revid: 2 },
  { path: 'Game/Assets/Art', type: 'dir', revid: 3 },
  { path: 'Game/Assets/Art/Textures', type: 'dir', revid: 4 },
  { path: 'Game/Assets/Art/Textures/bark.png', size: 10, revid: 5, changeset: 12, parentrevid: 50 },
  { path: 'Game/Assets/Art/Textures/bark.png.meta', type: 'txt', revid: 6 },
  { path: 'Game/Assets/Art/Textures/moss.png', size: 10, revid: 7, changeset: 12 },
  { path: 'Game/Assets/Art/Tree', type: 'dir', revid: 8 },
  { path: 'Game/Assets/Art/Tree/Tree.fbx', revid: 9 },
  { path: 'Game/Assets/Art/Materials', type: 'dir', revid: 10 },
  { path: 'Game/Assets/Art/Materials/Bark.mat', type: 'txt', revid: 11 },
  { path: 'Game/Assets/Art/Materials/Bark.mat.meta', type: 'txt', revid: 12 },
];
const TREE_FOLDER = PROJECT.filter((item) => item.path.startsWith('Game/Assets/Art/Tree'));
/** What each `.meta` revision holds, as the downloads read it. */
const METAS: Record<number, string> = { 6: meta(BARK_GUID), 12: meta(MAT_GUID) };

/** `cm ls <folder> --tree=<point> -R` answered from `items`: the folder and what's below it; a folder not there fails as `cm` does. */
function listing(items: ListedRecord[]): Extract<CmAnswer, (...args: never[]) => unknown> {
  return (command) => {
    const folder = command.args[1]!.replace(/^\//, '');
    const below = items.filter((item) => folder === '' || item.path === folder || item.path.startsWith(`${folder}/`));
    return below.length > 0 ? treeListingOutput(...below) : cmFails(`Can't resolve the selector for the item /${folder}`);
  };
}

async function setUp(items: ListedRecord[], { platform = 'darwin' as NodeJS.Platform, projectOnDisk = true } = {}) {
  const workspace = await mkdtemp(join(tmpdir(), 'assets-at-point-'));
  if (projectOnDisk) await mkdir(join(workspace, 'Game', 'ProjectSettings'), { recursive: true });
  const fake = fakeCmClient({ ls: listing(items) });
  const downloaded: RevisionFile[] = [];
  let time = 0;
  const unityAssets = createUnityAssetsService({
    cm: fake.cm,
    downloads: {
      read: async (_workspace, file) => {
        downloaded.push(file);
        return Buffer.from(METAS[file.revision.revisionId] ?? 'bytes');
      },
    },
    watchers: { listen: () => () => undefined, coverageOf: () => 'full' },
    platform,
    now: () => time,
  });
  const find = (request: Partial<UnityAssetsRequest>, point: AssetsPoint = { kind: 'repository', at: 'cs:12' }) =>
    unityAssets.find(workspace, { modelPath: 'Game/Assets/Art/Tree/Tree.fbx', point, textures: [], guids: [], paths: [], searchTexturesGlobally: false, ...request });
  return { workspace, unityAssets, fake, downloaded, find, later: (ms: number) => (time += ms) };
}

const lookup = (name: string, storedPaths: string[] = []) => ({ name, storedPaths, remapGuid: null });
const paths = (files: ({ path: string } | null)[]) => files.map((file) => file?.path ?? null);
const lsLines = (fake: ReturnType<typeof fakeCmClient>) => fake.commands.filter((command) => command.args[0] === 'ls').map((command) => `${command.via} ${command.args.slice(1, 3).join(' ')}`);

describe('unityAssets.find at a point of the repository', () => {
  it("finds a glTF's images beside it on a branch the workspace never loaded, by their revisions, listing only its folder", async () => {
    const { find, fake } = await setUp(GLTF_FOLDER, { projectOnDisk: false });
    const answer = await find(
      { modelPath: '3DModels/izh-27/scene.gltf', paths: ['3DModels/izh-27/textures/izh-27_baseColor.png', '3DModels/izh-27/textures/izh-27_normal.png', '3DModels/izh-27/textures/gone.png'] },
      { kind: 'repository', at: BRANCH },
    );
    expect(answer.paths).toEqual([
      { path: '3DModels/izh-27/textures/izh-27_baseColor.png', size: 8714025, stored: 'repository', revision: { revisionId: 29682, repository: 'eco@local' }, hash: 'gIxTMls7W/6uGzXpdYIprQ==' },
      { path: '3DModels/izh-27/textures/izh-27_normal.png', size: 12670152, stored: 'repository', revision: { revisionId: 29684, repository: 'eco@local' }, hash: 'hash29684==' },
      null,
    ]);
    expect(lsLines(fake)).toEqual([`query /3DModels/izh-27 --tree=${BRANCH}`]);
  });

  it("finds a texture past the model's folder in the project's listing, asked once, in a process of its own", async () => {
    const { find, fake } = await setUp(PROJECT);
    expect(paths((await find({ textures: [lookup('bark.png'), lookup('gone.png')] })).textures)).toEqual(['Game/Assets/Art/Textures/bark.png', null]);
    expect(paths((await find({ textures: [lookup('moss.png')] })).textures)).toEqual(['Game/Assets/Art/Textures/moss.png']);
    expect(lsLines(fake)).toEqual(['query /Game/Assets/Art/Tree --tree=cs:12', 'execute /Game --tree=cs:12']);
  });

  it('finds a remapped material by GUID through the .meta files of the point, read by revision', async () => {
    const { find, downloaded } = await setUp(PROJECT);
    const answer = await find({ guids: [MAT_GUID, BARK_GUID] });
    expect(paths(answer.guids)).toEqual(['Game/Assets/Art/Materials/Bark.mat', 'Game/Assets/Art/Textures/bark.png']);
    expect(answer.guidMisses).toBe('known');
    // Each found again is checked against its `.meta` once more (`pathOfGuid`), which the downloads keep.
    expect([...new Set(downloaded.map((file) => file.path))].sort()).toEqual(['Game/Assets/Art/Materials/Bark.mat.meta', 'Game/Assets/Art/Textures/bark.png.meta']);
  });

  it('lists each point once while kept: a changeset for good, a branch head again once it may have moved', async () => {
    const { find, fake, later } = await setUp(TREE_FOLDER);
    const branch: AssetsPoint = { kind: 'repository', at: BRANCH };
    const model = { paths: ['Game/Assets/Art/Tree/Tree.fbx'] };
    await Promise.all([find(model), find(model), find(model, branch), find(model, branch)]);
    expect(lsLines(fake)).toHaveLength(2);
    later(BRANCH_TREE_LIFE_MS);
    await Promise.all([find(model), find(model, branch)]);
    expect(lsLines(fake)).toEqual(['query /Game/Assets/Art/Tree --tree=cs:12', `query /Game/Assets/Art/Tree --tree=${BRANCH}`, `query /Game/Assets/Art/Tree --tree=${BRANCH}`]);
  });

  it('lists again after a listing failed, and finds nothing where the point has no such folder', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'assets-at-point-'));
    let fail = true;
    const fake = fakeCmClient({ ls: (command) => (fail ? ((fail = false), cmFails('The server is down')) : listing(TREE_FOLDER)(command) as string) });
    const unityAssets = createUnityAssetsService({ cm: fake.cm, downloads: { read: () => Promise.reject(new Error('no')) }, watchers: { listen: () => () => undefined, coverageOf: () => 'full' } });
    const request = { modelPath: 'Game/Assets/Art/Tree/Tree.fbx', point: { kind: 'repository', at: 'cs:12' } as const, textures: [], guids: [], paths: ['Game/Assets/Art/Tree/Tree.fbx'], searchTexturesGlobally: false };
    await expect(unityAssets.find(workspace, request)).rejects.toThrow('The server is down');
    expect(paths((await unityAssets.find(workspace, request)).paths)).toEqual(['Game/Assets/Art/Tree/Tree.fbx']);
    expect(paths((await unityAssets.find(workspace, { ...request, modelPath: 'Gone/Model.fbx', paths: ['Gone/a.png'] })).paths)).toEqual([null]);
  });

  it("reads the side before of a diff: what the diff changed as it was, what it added gone, what it deleted there", async () => {
    const { find } = await setUp(PROJECT);
    const before: AssetsPoint = {
      kind: 'repository',
      at: 'cs:12',
      before: {
        kind: 'changes',
        changes: [
          { path: 'Game/Assets/Art/Textures/bark.png', revision: { revisionId: 50, repository: 'eco@local' } },
          { path: 'Game/Assets/Art/Textures/moss.png', revision: null },
          { path: 'Game/Assets/Art/Old/leaf.png', revision: { revisionId: 60, repository: 'eco@local' } },
        ],
      },
    };
    const answer = await find({ textures: [lookup('bark.png'), lookup('moss.png'), lookup('leaf.png', ['../Old/leaf.png'])] }, before);
    expect(answer.textures).toEqual([
      { path: 'Game/Assets/Art/Textures/bark.png', size: -1, stored: 'repository', revision: { revisionId: 50, repository: 'eco@local' }, hash: null },
      null,
      { path: 'Game/Assets/Art/Old/leaf.png', size: -1, stored: 'repository', revision: { revisionId: 60, repository: 'eco@local' }, hash: null },
    ]);
  });

  it('reads the tree before a changeset: what it made as its parent revision, what it added gone', async () => {
    const { find } = await setUp(PROJECT);
    const answer = await find({ textures: [lookup('bark.png'), lookup('moss.png')] }, { kind: 'repository', at: 'cs:12', before: { kind: 'changeset', changeset: 12 } });
    expect(answer.textures).toEqual([{ path: 'Game/Assets/Art/Textures/bark.png', size: -1, stored: 'repository', revision: { revisionId: 50, repository: 'eco@local' }, hash: null }, null]);
  });

  it('compares names as the disk does: case aside on macOS and Windows, exactly on Linux', async () => {
    const request = { textures: [lookup('BARK.png')] };
    expect(paths((await (await setUp(PROJECT, { platform: 'darwin' })).find(request)).textures)).toEqual(['Game/Assets/Art/Textures/bark.png']);
    expect(paths((await (await setUp(PROJECT, { platform: 'linux' })).find(request)).textures)).toEqual([null]);
  });

  it("refuses a point whose tree can't be listed, or that a command can't carry", async () => {
    const { find } = await setUp(PROJECT);
    await expect(find({}, { kind: 'repository', at: 'sh:3' })).rejects.toThrow("can't be listed");
    await expect(find({}, { kind: 'repository', at: 'br:/main;rm' })).rejects.toThrow("can't be listed");
    await expect(find({}, { kind: 'repository', at: 'cs:1', before: { kind: 'changes', changes: [{ path: '../x', revision: null }] } })).rejects.toThrow('outside the workspace');
  });
});

describe('unityAssets.read', () => {
  it("reads a disk file from the disk, a repository's revision through the downloads, and refuses what isn't either", async () => {
    const { workspace, unityAssets, downloaded } = await setUp(PROJECT);
    const file = join(workspace, 'Art', 'bark.png');
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, 'png');
    expect(Buffer.from((await unityAssets.read(workspace, { path: 'Art/bark.png', size: 3, stored: 'disk', modified: 1 }))!).toString()).toBe('png');
    expect(await unityAssets.read(workspace, { path: 'Art/gone.png', size: 3, stored: 'disk', modified: 1 })).toBeNull();
    const revision = { revisionId: 12, repository: 'eco@local' };
    expect(Buffer.from((await unityAssets.read(workspace, { path: 'Art/Bark.mat.meta', size: -1, stored: 'repository', revision, hash: null }))!).toString()).toBe(meta(MAT_GUID));
    expect(downloaded).toEqual([{ path: 'Art/Bark.mat.meta', revision, hash: null, size: -1 }]);
    await expect(unityAssets.read(workspace, { path: '../../etc/passwd', size: 1, stored: 'disk', modified: 1 })).rejects.toThrow('outside the workspace');
    await expect(unityAssets.read(workspace, { path: 'a.png', size: 1, stored: 'repository', revision: { revisionId: 1, repository: 'eco@local;x' }, hash: null })).rejects.toThrow('Not a revision');
  });
});
