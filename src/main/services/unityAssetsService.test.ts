import { mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { WatchCoverage } from '@shared/api/workspaces';
import type { UnityAssetsRequest } from '@shared/domain/unityAssets';
import type { WorkspaceChange } from '@shared/domain/workspaceChange';
import { diskProjectFiles } from '../unity/diskProjectFiles';
import type { ProjectFiles } from '../unity/ProjectAssetIndex';
import type { WorkspaceFilesListener } from '../watch/WorkspaceWatchers';
import { createUnityAssetsService } from './unityAssetsService';

const BARK_GUID = '6d1e0c9b8a7f4e3d2c1b0a9f8e7d6c5b';
const MAT_GUID = '0f2b6c1e9a8d4b3c8e7f6a5b4c3d2e1f';

/** A workspace folder with these files (workspace-relative path → text). */
async function workspaceWith(files: Record<string, string>): Promise<string> {
  const workspace = await mkdtemp(join(tmpdir(), 'unity-assets-'));
  for (const [path, text] of Object.entries(files)) await writeAt(workspace, path, text);
  return workspace;
}

async function writeAt(workspace: string, path: string, text: string): Promise<void> {
  const file = join(workspace, ...path.split('/'));
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, text);
}

const meta = (guid: string): string => `fileFormatVersion: 2\nguid: ${guid}\nTextureImporter:\n  serializedVersion: 13\n`;

/** The service over a workspace, with the reads its project index makes counted and the watcher's events in hand. */
function service(workspace: string, platform: NodeJS.Platform = process.platform, coverage: WatchCoverage | undefined = 'full') {
  const reads = { lists: 0, heads: 0 };
  const listeners: WorkspaceFilesListener[] = [];
  const counted = (path: string): ProjectFiles => {
    const disk = diskProjectFiles(path);
    return {
      list: (folder) => (reads.lists++, disk.list(folder)),
      head: (file, length) => (reads.heads++, disk.head(file, length)),
    };
  };
  const unityAssets = createUnityAssetsService({ watchers: { listen: (listener) => (listeners.push(listener), () => undefined), coverageOf: () => coverage }, platform, filesOf: counted });
  const changed = (change: Partial<WorkspaceChange>) => listeners.forEach((listener) => listener.changed(workspace, { content: true, pathsChanged: true, metadata: false, folders: null, ...change }));
  return { find: (request: Partial<UnityAssetsRequest>) => unityAssets.find(workspace, { modelPath: 'Game/Assets/Art/Tree/Tree.fbx', textures: [], guids: [], paths: [], searchTexturesGlobally: false, ...request }), reads, changed };
}

const lookup = (name: string, storedPaths: string[] = [], remapGuid: string | null = null) => ({ name, storedPaths, remapGuid });
const paths = (answer: { path: string }[] | (null | { path: string })[]) => answer.map((file) => file?.path ?? null);

describe('unityAssets.find', () => {
  it("finds a texture beside the model, in a Textures folder above it, at a stored path, and says which aren't there", async () => {
    const workspace = await workspaceWith({
      'Game/Assets/Art/Tree/bark.png': 'png',
      'Game/Assets/Art/Textures/leaves.tga': 'tga',
      'Game/Assets/Shared/moss.psd': 'psd',
    });
    const { find, reads } = service(workspace);
    const answer = await find({ textures: [lookup('bark.png'), lookup('leaves.tga'), lookup('moss.psd', ['..\\..\\Shared\\moss.psd']), lookup('gone.png')] });
    expect(paths(answer.textures)).toEqual(['Game/Assets/Art/Tree/bark.png', 'Game/Assets/Art/Textures/leaves.tga', 'Game/Assets/Shared/moss.psd', null]);
    expect(answer.textures[0]).toMatchObject({ size: 3, modified: expect.any(Number) });
    // Unity's folders first: no index of the project was read.
    expect(reads).toEqual({ lists: 0, heads: 0 });
  });

  it("finds a texture anywhere in the project only with the model's global search, the nearest first", async () => {
    const workspace = await workspaceWith({
      'Game/Assets/Zoo/bark.png': 'far',
      'Game/Assets/Art/Tree/Maps/bark.png': 'near',
      'Game/Library/bark.png': 'cache',
    });
    expect(paths((await service(workspace).find({ textures: [lookup('bark.png')] })).textures)).toEqual([null]);
    const { find, reads } = service(workspace);
    expect(paths((await find({ textures: [lookup('bark.png')], searchTexturesGlobally: true })).textures)).toEqual(['Game/Assets/Art/Tree/Maps/bark.png']);
    // The model's folder answered: nothing else of the project was listed.
    expect(reads.lists).toBe(2);
  });

  it("finds a remapped material and texture by GUID, reading the project's .meta files from the model outward", async () => {
    const workspace = await workspaceWith({
      'Game/Assets/Art/Tree/Tree.fbx': 'fbx',
      'Game/Assets/Art/Tree/Materials/Bark.mat': 'mat',
      'Game/Assets/Art/Tree/Materials/Bark.mat.meta': meta(MAT_GUID),
      'Game/Assets/Art/Rocks/rock.png.meta': meta('11111111111111111111111111111111'),
      'Game/Assets/Textures/bark_albedo.png': 'png',
      'Game/Assets/Textures/bark_albedo.png.meta': meta(BARK_GUID),
    });
    const { find, reads } = service(workspace);
    const answer = await find({ guids: [MAT_GUID], textures: [lookup('bark.png', [], BARK_GUID)] });
    expect(paths(answer.guids)).toEqual(['Game/Assets/Art/Tree/Materials/Bark.mat']);
    expect(paths(answer.textures)).toEqual(['Game/Assets/Textures/bark_albedo.png']);

    const before = { ...reads };
    expect(paths((await find({ guids: [MAT_GUID] })).guids)).toEqual(['Game/Assets/Art/Tree/Materials/Bark.mat']);
    // Known: only the hit's .meta is read again, to check it still says so.
    expect(reads).toEqual({ lists: before.lists, heads: before.heads + 1 });
  });

  it("keeps the project's index current from the watcher: a moved .meta found at its new place", async () => {
    const workspace = await workspaceWith({ 'Game/Assets/Art/Materials/Bark.mat': 'mat', 'Game/Assets/Art/Materials/Bark.mat.meta': meta(MAT_GUID) });
    const { find, changed } = service(workspace);
    expect(paths((await find({ guids: [MAT_GUID] })).guids)).toEqual(['Game/Assets/Art/Materials/Bark.mat']);

    await mkdir(join(workspace, 'Game', 'Assets', 'Shared'));
    for (const name of ['Bark.mat', 'Bark.mat.meta']) await rename(join(workspace, 'Game', 'Assets', 'Art', 'Materials', name), join(workspace, 'Game', 'Assets', 'Shared', name));
    changed({ folders: ['Game/Assets/Art/Materials', 'Game/Assets', 'Game/Assets/Shared'] });
    expect(paths((await find({ guids: [MAT_GUID] })).guids)).toEqual(['Game/Assets/Shared/Bark.mat']);

    await rm(join(workspace, 'Game', 'Assets', 'Shared'), { recursive: true });
    changed({ folders: null });
    expect(paths((await find({ guids: [MAT_GUID] })).guids)).toEqual([null]);
  });

  it("tells whether the model's project imports .psb files: only with the 2D PSD Importer package", async () => {
    const manifest = (packages: string[]) => JSON.stringify({ dependencies: Object.fromEntries(packages.map((name) => [name, '1.0.0'])) });
    const withImporter = await workspaceWith({ 'Game/Packages/manifest.json': manifest(['com.unity.render-pipelines.universal', 'com.unity.2d.psdimporter']) });
    expect((await service(withImporter).find({})).importsPsb).toBe(true);
    // Brought in by another package: the lock lists it.
    const locked = await workspaceWith({ 'Game/Packages/manifest.json': manifest(['com.unity.feature.2d']), 'Game/Packages/packages-lock.json': JSON.stringify({ dependencies: { 'com.unity.2d.psdimporter': { version: '9.0.0' } } }) });
    expect((await service(locked).find({})).importsPsb).toBe(true);
    const without = await workspaceWith({ 'Game/Packages/manifest.json': manifest(['com.unity.render-pipelines.universal']) });
    expect((await service(without).find({})).importsPsb).toBe(false);
    expect((await service(await workspaceWith({})).find({ modelPath: 'Art/Tree.fbx' })).importsPsb).toBe(false);
  });

  it("keeps no index of a workspace whose watcher doesn't see every change: each find reads afresh", async () => {
    const files = { 'Game/Assets/Art/Materials/Bark.mat': 'mat', 'Game/Assets/Art/Materials/Bark.mat.meta': meta(MAT_GUID) };
    for (const coverage of ['partial', undefined] as const) {
      const { find, reads } = service(await workspaceWith(files), process.platform, coverage);
      await find({ guids: [MAT_GUID] });
      const first = reads.lists;
      await find({ guids: [MAT_GUID] });
      expect(reads.lists).toBe(first * 2);
    }
  });

  it('finds an asset of a local package by GUID', async () => {
    const workspace = await workspaceWith({ 'Game/Packages/com.studio.trees/Materials/Leaf.mat': 'mat', 'Game/Packages/com.studio.trees/Materials/Leaf.mat.meta': meta(MAT_GUID) });
    expect(paths((await service(workspace).find({ guids: [MAT_GUID] })).guids)).toEqual(['Game/Packages/com.studio.trees/Materials/Leaf.mat']);
  });

  it('tells files at known paths, never one outside the workspace', async () => {
    const workspace = await workspaceWith({ 'Models/textures/leaf color.png': 'png' });
    const answer = await service(workspace).find({ modelPath: 'Models/Leaf.gltf', paths: ['Models/textures/leaf color.png', 'Models/missing.png', '../../etc/passwd', '/etc/passwd'] });
    expect(paths(answer.paths)).toEqual(['Models/textures/leaf color.png', null, null, null]);
    await expect(service(workspace).find({ modelPath: '../Outside.fbx' })).rejects.toThrow('outside the workspace');
  });

  it('runs no cm command: neither it nor what it reads with can reach cm', async () => {
    const sources = [join(__dirname, 'unityAssetsService.ts'), ...(await readdir(join(__dirname, '..', 'unity'))).filter((name) => !name.endsWith('.test.ts')).map((name) => join(__dirname, '..', 'unity', name))];
    for (const source of sources) expect(await readFile(source, 'utf8'), source).not.toMatch(/from '\.\.?\/(\.\.\/)?cm\//);
  });
});
