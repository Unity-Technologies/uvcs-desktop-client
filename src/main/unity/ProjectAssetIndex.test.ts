import { describe, expect, it } from 'vitest';
import { ProjectAssetIndex, type ProjectFiles } from './ProjectAssetIndex';
import { unityProjectOf } from './unityProject';

const guid = (n: number): string => n.toString(16).padStart(32, '0');
const meta = (n: number): string => `fileFormatVersion: 2\r\nguid: ${guid(n)}\r\nDefaultImporter:\r\n`;

/** Files in memory, by workspace-relative path, with the folders they make; what is read is counted. */
function memoryFiles(files: Map<string, string>) {
  const reads = { lists: 0, heads: 0 };
  const disk: ProjectFiles = {
    async list(folder) {
      reads.lists++;
      const prefix = folder === '' ? '' : `${folder}/`;
      const entries = new Map<string, boolean>();
      for (const path of files.keys()) {
        if (!path.startsWith(prefix)) continue;
        const [name, ...rest] = path.slice(prefix.length).split('/');
        entries.set(name!, rest.length > 0);
      }
      return [...entries].map(([name, isFolder]) => ({ name, isFolder }));
    },
    async head(path, length) {
      reads.heads++;
      return files.get(path)?.slice(0, length) ?? null;
    },
  };
  return { disk, reads };
}

/** A project of `far` folders of ten assets each, and a material beside the model. */
function project(far: number) {
  const files = new Map<string, string>([
    ['Game/Assets/Art/Tree/Tree.fbx', 'fbx'],
    ['Game/Assets/Art/Tree/Bark.mat', 'mat'],
    ['Game/Assets/Art/Tree/Bark.mat.meta', meta(1)],
    ['Game/Library/Artifacts/big.bin', 'cache'],
  ]);
  for (let folder = 0; folder < far; folder++) {
    for (let asset = 0; asset < 10; asset++) {
      files.set(`Game/Assets/Far${folder}/rock${asset}.png`, 'png');
      files.set(`Game/Assets/Far${folder}/rock${asset}.png.meta`, meta(1000 + folder * 10 + asset));
    }
  }
  return files;
}

const MODEL_FOLDER = 'Game/Assets/Art/Tree';

describe('ProjectAssetIndex', () => {
  it("reads only the model's surroundings for an asset near it, however big the project", async () => {
    const small = memoryFiles(project(10));
    const big = memoryFiles(project(1000));
    for (const { disk } of [small, big]) {
      expect(await new ProjectAssetIndex(unityProjectOf('Game/Assets/Art/Tree/Tree.fbx')!, disk, 'linux').pathOfGuid(guid(1), MODEL_FOLDER)).toBe('Game/Assets/Art/Tree/Bark.mat');
    }
    expect(big.reads).toEqual(small.reads);
  });

  it('reads the whole project once for a GUID it lacks, never Library, and nothing more for the next', async () => {
    const { disk, reads } = memoryFiles(project(20));
    const index = new ProjectAssetIndex(unityProjectOf('Game/Assets/Art/Tree/Tree.fbx')!, disk, 'linux');
    expect(await index.pathOfGuid(guid(999999), MODEL_FOLDER)).toBeNull();
    // Every .meta of Assets once (201), each folder of Assets and Packages once (24).
    expect(reads).toEqual({ lists: 24, heads: 201 });
    expect(await index.pathOfGuid(guid(1000 + 55), MODEL_FOLDER)).toBe('Game/Assets/Far5/rock5.png');
    expect(await index.pathOfGuid(guid(888888), MODEL_FOLDER)).toBeNull();
    // The hit's .meta read again to check it, nothing else.
    expect(reads).toEqual({ lists: 24, heads: 202 });
  });

  it('reads again only the folders the watcher saw change', async () => {
    const files = project(20);
    const { disk, reads } = memoryFiles(files);
    const index = new ProjectAssetIndex(unityProjectOf('Game/Assets/Art/Tree/Tree.fbx')!, disk, 'linux');
    await index.pathOfGuid(guid(999999), MODEL_FOLDER);
    files.set('Game/Assets/Far3/new.png.meta', meta(77));
    files.set('Game/Assets/Far3/new.png', 'png');
    index.noteChange({ content: true, pathsChanged: true, metadata: false, folders: ['Game/Assets/Far3'] });

    const before = { ...reads };
    expect(await index.pathOfGuid(guid(77), MODEL_FOLDER)).toBe('Game/Assets/Far3/new.png');
    expect(reads).toEqual({ lists: before.lists + 1, heads: before.heads + 11 + 1 });
  });

  it('finds files by name as the OS compares them, the nearest ring first', async () => {
    const files = new Map([
      ['Game/Assets/Art/Tree/Maps/Bark.PNG', ''],
      ['Game/Assets/Art/Other/bark.png', ''],
    ]);
    const project = unityProjectOf('Game/Assets/Art/Tree/Tree.fbx')!;
    const rings = ['Game/Assets/Art/Tree', 'Game/Assets/Art', 'Game/Assets'];
    expect(await new ProjectAssetIndex(project, memoryFiles(files).disk, 'darwin').pathsNamed('bark.png', rings)).toEqual(['Game/Assets/Art/Tree/Maps/Bark.PNG']);
    expect(await new ProjectAssetIndex(project, memoryFiles(files).disk, 'win32').pathsNamed('BARK.png', rings)).toEqual(['Game/Assets/Art/Tree/Maps/Bark.PNG']);
    expect(await new ProjectAssetIndex(project, memoryFiles(files).disk, 'linux').pathsNamed('bark.png', rings)).toEqual(['Game/Assets/Art/Other/bark.png']);
  });

  it("leaves out what Unity leaves out: hidden files and folders ending in '~'", async () => {
    const files = new Map([
      ['Game/Assets/Docs~/a.mat.meta', meta(5)],
      ['Game/Assets/.hidden/b.mat.meta', meta(6)],
    ]);
    const index = new ProjectAssetIndex(unityProjectOf('Game/Assets/Tree.fbx')!, memoryFiles(files).disk, 'linux');
    expect(await index.pathOfGuid(guid(5), 'Game/Assets')).toBeNull();
    expect(await index.pathOfGuid(guid(6), 'Game/Assets')).toBeNull();
  });
});
