import { describe, expect, it } from 'vitest';
import { ProjectAssetIndex, type ProjectFiles } from './ProjectAssetIndex';
import { unityProjectOf } from './unityProject';

const guid = (n: number): string => n.toString(16).padStart(32, '0');
const meta = (n: number): string => `fileFormatVersion: 2\r\nguid: ${guid(n)}\r\nDefaultImporter:\r\n`;

/**
 * Files in memory, by workspace-relative path, with the folders they make; what is read is counted. `failing`: reads
 * of these that fail as many times, as a file another program holds open does (EMFILE, EBUSY). `held`: folders whose
 * next listing, read as the disk is then, is answered only once the promise its function gives settles, as a slow
 * disk answers while files change. Paths are found whatever their Unicode form, as macOS finds them.
 */
function memoryFiles(files: Map<string, string>, failing: Map<string, number> = new Map(), held: Map<string, () => Promise<void>> = new Map()) {
  const reads = { lists: 0, heads: 0 };
  const fail = (path: string): void => {
    const left = failing.get(path) ?? 0;
    if (left === 0) return;
    failing.set(path, left - 1);
    throw Object.assign(new Error(`EBUSY: resource busy or locked, ${path}`), { code: 'EBUSY' });
  };
  const disk: ProjectFiles = {
    async list(folder) {
      reads.lists++;
      fail(folder);
      folder = folder.normalize('NFC');
      const prefix = folder === '' ? '' : `${folder}/`;
      const entries = new Map<string, boolean>();
      for (const path of files.keys()) {
        if (!path.startsWith(prefix)) continue;
        const [name, ...rest] = path.slice(prefix.length).split('/');
        entries.set(name!, rest.length > 0);
      }
      const hold = held.get(folder);
      held.delete(folder);
      await hold?.();
      return [...entries].map(([name, isFolder]) => ({ name, isFolder }));
    },
    async head(path, length) {
      reads.heads++;
      fail(path);
      return files.get(path.normalize('NFC'))?.slice(0, length) ?? null;
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
    ['Game/Library/PackageCache/com.unity.ugui@2.0.0/package.json', '{}'],
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

/** A promise and what settles it, for a read the test answers when it chooses. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve = (): void => undefined;
  const promise = new Promise<void>((settle) => (resolve = settle));
  return { promise, resolve };
}

describe('ProjectAssetIndex', () => {
  it("reads only the model's surroundings for an asset near it, however big the project", async () => {
    const small = memoryFiles(project(10));
    const big = memoryFiles(project(1000));
    for (const { disk } of [small, big]) {
      expect(await new ProjectAssetIndex(unityProjectOf('Game/Assets/Art/Tree/Tree.fbx')!, disk, 'linux').pathOfGuid(guid(1), MODEL_FOLDER)).toBe('Game/Assets/Art/Tree/Bark.mat');
    }
    expect(big.reads).toEqual(small.reads);
  });

  it("reads the whole project once for a GUID it lacks, of Library only its package cache, and nothing more for the next", async () => {
    const { disk, reads } = memoryFiles(project(20));
    const index = new ProjectAssetIndex(unityProjectOf('Game/Assets/Art/Tree/Tree.fbx')!, disk, 'linux');
    expect(await index.pathOfGuid(guid(999999), MODEL_FOLDER)).toBeNull();
    // Every .meta of Assets once (201), each folder of Assets and Packages once (24), Library's PackageCache and the
    // one package there once (2): never Library's Artifacts.
    expect(reads).toEqual({ lists: 26, heads: 201 });
    expect(await index.pathOfGuid(guid(1000 + 55), MODEL_FOLDER)).toBe('Game/Assets/Far5/rock5.png');
    expect(await index.pathOfGuid(guid(888888), MODEL_FOLDER)).toBeNull();
    // The hit's .meta read again to check it, and the package cache's top listed again for the miss, nothing else.
    expect(reads).toEqual({ lists: 27, heads: 202 });
  });

  it("finds a registry package's GUID in Library/PackageCache, and can't tell one missing without a Library", async () => {
    const files = new Map([...project(1), ['Game/Library/PackageCache/com.unity.render-pipelines.universal@17.0.3/Lit.mat.meta', meta(42)]]);
    const index = new ProjectAssetIndex(unityProjectOf('Game/Assets/Art/Tree/Tree.fbx')!, memoryFiles(files).disk, 'linux');
    expect(await index.pathOfGuid(guid(42), MODEL_FOLDER)).toBe('Game/Library/PackageCache/com.unity.render-pipelines.universal@17.0.3/Lit.mat');
    const fresh = new Map([...project(1)].filter(([path]) => !path.startsWith('Game/Library/')));
    const neverOpened = new ProjectAssetIndex(unityProjectOf('Game/Assets/Art/Tree/Tree.fbx')!, memoryFiles(fresh).disk, 'linux');
    expect(await neverOpened.pathOfGuid(guid(42), MODEL_FOLDER)).toEqual({ notKnown: 'noLibrary' });
    expect(await neverOpened.pathOfGuid(guid(1), MODEL_FOLDER)).toBe('Game/Assets/Art/Tree/Bark.mat');
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
      ['Game/Library/PackageCache/com.unity.ugui@2.0.0/package.json', '{}'],
    ]);
    const index = new ProjectAssetIndex(unityProjectOf('Game/Assets/Tree.fbx')!, memoryFiles(files).disk, 'linux');
    expect(await index.pathOfGuid(guid(5), 'Game/Assets')).toBeNull();
    expect(await index.pathOfGuid(guid(6), 'Game/Assets')).toBeNull();
  });

  it('reads each folder once for finds made at the same time, and nothing for a GUID it lacks once it read all', async () => {
    const { disk, reads } = memoryFiles(project(20));
    const index = new ProjectAssetIndex(unityProjectOf('Game/Assets/Art/Tree/Tree.fbx')!, disk, 'linux');
    await Promise.all([index.pathOfGuid(guid(999999), MODEL_FOLDER), index.pathOfGuid(guid(888888), MODEL_FOLDER)]);
    expect(reads).toEqual({ lists: 26, heads: 201 });
  });

  it("doesn't keep a read that failed as an empty folder or a .meta without a GUID, nor tell the GUID missing: the next find reads it again", async () => {
    for (const failing of ['Game/Assets/Far0', 'Game/Assets/Far0/rock3.png.meta']) {
      // Failing as long as the first find reads it (its rings reach `Assets` twice).
      const { disk } = memoryFiles(project(1), new Map([[failing, 2]]));
      const index = new ProjectAssetIndex(unityProjectOf('Game/Assets/Art/Tree/Tree.fbx')!, disk, 'linux');
      expect(await index.pathOfGuid(guid(1003), MODEL_FOLDER)).toEqual({ notKnown: 'unread' });
      expect(await index.pathOfGuid(guid(1003), MODEL_FOLDER)).toBe('Game/Assets/Far0/rock3.png');
    }
  });

  it('on macOS, takes a change the watcher names in another Unicode form for the folder it listed', async () => {
    const composed = 'Game/Assets/Ñandú Armería';
    const files = new Map([
      [`${composed}/espada.png.meta`, meta(1)],
      [`${composed}/espada.png`, ''],
    ]);
    const { disk, reads } = memoryFiles(files);
    const index = new ProjectAssetIndex(unityProjectOf(`${composed}/Espada.fbx`)!, disk, 'darwin');
    expect(await index.pathOfGuid(guid(1), composed)).toBe(`${composed}/espada.png`);
    files.set(`${composed}/escudo.png.meta`, meta(2));
    files.set(`${composed}/escudo.png`, '');
    index.noteChange({ content: true, pathsChanged: true, metadata: false, folders: [composed.normalize('NFD')] });
    const before = reads.lists;
    expect(await index.pathOfGuid(guid(2), composed.normalize('NFD'))).toBe(`${composed}/escudo.png`);
    // The folder read once again, under one key.
    expect(reads.lists).toBe(before + 1);
  });

  it('keeps no answer a change made stale while the whole project was being read', async () => {
    const files = project(3);
    const packagesReached = deferred();
    const packagesRead = deferred();
    const holdPackages = () => (packagesReached.resolve(), packagesRead.promise);
    const { disk } = memoryFiles(files, new Map(), new Map([['Game/Packages', holdPackages]]));
    const index = new ProjectAssetIndex(unityProjectOf('Game/Assets/Art/Tree/Tree.fbx')!, disk, 'linux');
    const walk = index.pathOfGuid(guid(999999), MODEL_FOLDER);
    // Unity saves a material in a folder the walk already read, before the walk ends.
    await packagesReached.promise;
    files.set('Game/Assets/Far1/Bark2.mat', 'mat');
    files.set('Game/Assets/Far1/Bark2.mat.meta', meta(77));
    index.noteChange({ content: true, pathsChanged: true, metadata: false, folders: ['Game/Assets/Far1'] });
    packagesRead.resolve();
    // Overtaken: it can't tell the GUID missing.
    expect(await walk).toEqual({ notKnown: 'unread' });
    expect(await index.pathOfGuid(guid(77), MODEL_FOLDER)).toBe('Game/Assets/Far1/Bark2.mat');
  });

  it('a find after a change reads the disk again, never joining or keeping a read started before it', async () => {
    const files = project(3);
    const far1Reached = deferred();
    const far1Read = deferred();
    const holdFar1 = () => (far1Reached.resolve(), far1Read.promise);
    const { disk } = memoryFiles(files, new Map(), new Map([['Game/Assets/Far1', holdFar1]]));
    const index = new ProjectAssetIndex(unityProjectOf('Game/Assets/Art/Tree/Tree.fbx')!, disk, 'linux');
    const before = index.pathOfGuid(guid(999999), MODEL_FOLDER);
    await far1Reached.promise;
    files.set('Game/Assets/Far1/Bark2.mat', 'mat');
    files.set('Game/Assets/Far1/Bark2.mat.meta', meta(77));
    index.clear();
    const after = index.pathOfGuid(guid(77), MODEL_FOLDER);
    far1Read.resolve();
    expect(await before).toEqual({ notKnown: 'unread' });
    expect(await after).toBe('Game/Assets/Far1/Bark2.mat');
    // Nor does the stale listing, settled after the change, stand in for the folder.
    expect(await index.pathOfGuid(guid(77), MODEL_FOLDER)).toBe('Game/Assets/Far1/Bark2.mat');
  });

  describe('the package cache, when in doubt, never tells a GUID missing', () => {
    const CACHE = 'Game/Library/PackageCache';
    const URP = `${CACHE}/com.unity.render-pipelines.universal@17.0.3`;
    const withCache = () => new Map([...project(1), [`${URP}/Lit.mat`, 'mat'], [`${URP}/Lit.mat.meta`, meta(42)], [`${URP}/Unlit.mat.meta`, meta(43)]]);
    const indexOf = (disk: ProjectFiles) => new ProjectAssetIndex(unityProjectOf('Game/Assets/Art/Tree/Tree.fbx')!, disk, 'linux');

    it('answers undefined while a read of the cache failed, and finds the GUID once read again', async () => {
      for (const failing of [URP, `${URP}/Lit.mat.meta`]) {
        const index = indexOf(memoryFiles(withCache(), new Map([[failing, 1]])).disk);
        expect(await index.pathOfGuid(guid(42), MODEL_FOLDER)).toEqual({ notKnown: 'unread' });
        expect(await index.pathOfGuid(guid(42), MODEL_FOLDER)).toBe(`${URP}/Lit.mat`);
      }
    });

    it('answers undefined for a read of the cache a change overtook', async () => {
      let index: ProjectAssetIndex;
      const held = new Map([[CACHE, async () => index.noteChange({ content: true, pathsChanged: true, metadata: false, folders: null })]]);
      index = indexOf(memoryFiles(withCache(), new Map(), held).disk);
      expect(await index.pathOfGuid(guid(99), MODEL_FOLDER)).toEqual({ notKnown: 'unread' });
      expect(await index.pathOfGuid(guid(42), MODEL_FOLDER)).toBe(`${URP}/Lit.mat`);
    });

    it('reads the cache again when Unity replaced a package in it, which the watcher never tells', async () => {
      const files = withCache();
      const { disk, reads } = memoryFiles(files);
      const index = indexOf(disk);
      expect(await index.pathOfGuid(guid(42), MODEL_FOLDER)).toBe(`${URP}/Lit.mat`);
      expect(await index.pathOfGuid(guid(99), MODEL_FOLDER)).toBeNull();
      // Unity upgrades URP: the old version's folder goes, the new one comes, and Packages' lock already said so.
      const upgraded = `${CACHE}/com.unity.render-pipelines.universal@17.0.4`;
      for (const path of [...files.keys()]) if (path.startsWith(URP)) files.delete(path);
      files.set(`${upgraded}/Lit.mat`, 'mat');
      files.set(`${upgraded}/Lit.mat.meta`, meta(42));
      files.set(`${upgraded}/Decal.mat.meta`, meta(44));
      expect(await index.pathOfGuid(guid(42), MODEL_FOLDER)).toBe(`${upgraded}/Lit.mat`);
      expect(await index.pathOfGuid(guid(44), MODEL_FOLDER)).toBe(`${upgraded}/Decal.mat`);
      // Read whole and unchanged, a miss costs one listing of the cache's top.
      const before = reads.lists;
      expect(await index.pathOfGuid(guid(99), MODEL_FOLDER)).toBeNull();
      expect(reads.lists).toBe(before + 1);
    });

    it('finds a GUID of a package Unity added to the cache, which the watcher never tells', async () => {
      const files = withCache();
      const index = indexOf(memoryFiles(files).disk);
      expect(await index.pathOfGuid(guid(44), MODEL_FOLDER)).toBeNull();
      files.set(`${CACHE}/com.unity.shadergraph@17.0.3/Decal.mat.meta`, meta(44));
      files.set(`${CACHE}/com.unity.shadergraph@17.0.3/Decal.mat`, 'mat');
      expect(await index.pathOfGuid(guid(44), MODEL_FOLDER)).toBe(`${CACHE}/com.unity.shadergraph@17.0.3/Decal.mat`);
    });

    it("keeps the cache across a change anywhere, as the watcher never sees it: a package's GUID is known at once", async () => {
      const { disk, reads } = memoryFiles(withCache());
      const index = indexOf(disk);
      expect(await index.pathOfGuid(guid(42), MODEL_FOLDER)).toBe(`${URP}/Lit.mat`);
      index.noteChange({ content: true, pathsChanged: true, metadata: false, folders: null });
      const before = { ...reads };
      expect(await index.pathOfGuid(guid(42), MODEL_FOLDER)).toBe(`${URP}/Lit.mat`);
      // Only its .meta, checked.
      expect(reads).toEqual({ lists: before.lists, heads: before.heads + 1 });
    });

    it("can't tell a GUID missing in a Library without a package cache, or with an empty one: Unity hasn't resolved its packages here", async () => {
      const withoutCache = new Map([...project(1)].filter(([path]) => !path.startsWith('Game/Library/PackageCache/')));
      expect(await indexOf(memoryFiles(withoutCache).disk).pathOfGuid(guid(99), MODEL_FOLDER)).toEqual({ notKnown: 'noLibrary' });
      const emptyCache = new Map([...withoutCache, ['Game/Library/PackageCache/.DS_Store', '']]);
      const index = indexOf(memoryFiles(emptyCache).disk);
      expect(await index.pathOfGuid(guid(99), MODEL_FOLDER)).toEqual({ notKnown: 'noLibrary' });
    });

    it("can't tell a GUID missing once the Library is deleted", async () => {
      const files = withCache();
      const index = indexOf(memoryFiles(files).disk);
      expect(await index.pathOfGuid(guid(99), MODEL_FOLDER)).toBeNull();
      for (const path of [...files.keys()]) if (path.startsWith('Game/Library/')) files.delete(path);
      expect(await index.pathOfGuid(guid(99), MODEL_FOLDER)).toEqual({ notKnown: 'noLibrary' });
    });
  });
});
