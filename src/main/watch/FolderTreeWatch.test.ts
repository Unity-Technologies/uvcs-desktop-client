import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FolderTreeWatch } from './FolderTreeWatch';
import { fakeFolderWatches } from './testing/fakeFolderWatches';
import type { WatchFolder } from './watchFolder';

interface Options {
  skip?: (folder: string) => boolean;
  maxFolders?: number;
  unwatchable?: string[];
  /** Called as each folder gets watched (its relative and absolute paths), to act at that point of the walk. */
  whenWatched?: (folder: string, path: string, tree: FolderTreeWatch) => void;
}

/**
 * A real folder tree (src/deep, Library/Cache) watched through fake watches the test fires. As with `fs.watch`, a
 * folder that doesn't exist can't be watched.
 */
function setUp(options: Options = {}) {
  const root = mkdtempSync(join(tmpdir(), 'folder-tree-'));
  mkdirSync(join(root, 'src', 'deep'), { recursive: true });
  mkdirSync(join(root, 'Library', 'Cache'), { recursive: true });
  const at = (folder: string): string => (folder ? join(root, ...folder.split('/')) : root);
  const relative = (path: string): string => (path === root ? '' : path.slice(root.length + 1).split(/[\\/]/).join('/'));
  const watches = fakeFolderWatches((options.unwatchable ?? []).map((folder) => ({ path: at(folder) })));
  const everWatched: string[] = [];
  const watch: WatchFolder = (path, recursive, onEvent) => {
    if (!existsSync(path)) throw Object.assign(new Error(`ENOENT: no such file or directory, watch '${path}'`), { code: 'ENOENT' });
    const folderWatch = watches.watch(path, recursive, onEvent);
    everWatched.push(relative(path));
    options.whenWatched?.(relative(path), path, tree);
    return folderWatch;
  };
  const events: string[] = [];
  let broken = 0;
  const tree = new FolderTreeWatch(
    root,
    options.skip ?? (() => false),
    (event, path) => events.push(`${event} ${path}`),
    () => broken++,
    options.maxFolders ?? 100,
    watch,
  );
  return {
    root,
    tree,
    events,
    /** The watched folders, workspace-relative and sorted. */
    watched: (): string[] => [...watches.watched().keys()].map(relative).sort(),
    /** Every folder that was ever watched, even if it isn't anymore. */
    everWatched: (): string[] => [...everWatched].sort(),
    at,
    emit: (folder: string, event: 'rename' | 'change', name: string | null) => watches.emit(at(folder), event, name),
    watches,
    timesBroken: () => broken,
  };
}

describe('FolderTreeWatch', () => {
  it('watches each folder of the tree with a plain watch, and reports items by their workspace-relative path', async () => {
    const { tree, watched, emit, events, watches } = setUp();

    expect(await tree.start()).toBe(true);
    expect(watched()).toEqual(['', 'Library', 'Library/Cache', 'src', 'src/deep']);
    expect([...watches.watched().values()].every((recursive) => !recursive)).toBe(true);

    emit('src/deep', 'change', 'app.ts');
    emit('', 'change', 'README.md');
    expect(events).toEqual(['change src/deep/app.ts', 'change README.md']);
  });

  it('keeps watching a folder whose file was saved by replacing it', async () => {
    const { tree, watched, emit, events } = setUp();
    await tree.start();

    emit('src/deep', 'rename', 'app.ts');
    emit('src/deep', 'change', 'app.ts');
    expect(watched()).toContain('src/deep');
    expect(events).toEqual(['rename src/deep/app.ts', 'change src/deep/app.ts']);
  });

  it('watches folders created after it started, with everything inside them', async () => {
    const { tree, watched, emit, at } = setUp();
    await tree.start();

    mkdirSync(at('new/deeper'), { recursive: true });
    emit('', 'rename', 'new');
    await tree.idle();
    expect(watched()).toEqual(expect.arrayContaining(['new', 'new/deeper']));
  });

  it('follows a folder moved elsewhere in the tree: the old paths go, the new ones are watched', async () => {
    const { tree, watched, emit, at } = setUp();
    await tree.start();

    renameSync(at('src/deep'), at('Library/deep'));
    emit('src', 'rename', 'deep');
    emit('Library', 'rename', 'deep');
    await tree.idle();
    expect(watched()).toEqual(['', 'Library', 'Library/Cache', 'Library/deep', 'src']);
  });

  it('stops watching a deleted folder and everything that was under it', async () => {
    const { tree, watched, emit, at } = setUp();
    await tree.start();

    rmSync(at('src'), { recursive: true });
    emit('', 'rename', 'src');
    expect(watched()).toEqual(['', 'Library', 'Library/Cache']);
  });

  it('never walks skipped folders, even when they appear later', async () => {
    const { tree, watched, emit, at } = setUp({ skip: (folder) => folder === 'Library' || folder.endsWith('/obj') });
    await tree.start();
    expect(watched()).toEqual(['', 'src', 'src/deep']);

    mkdirSync(at('src/obj'));
    emit('src', 'rename', 'obj');
    await tree.idle();
    expect(watched()).toEqual(['', 'src', 'src/deep']);
  });

  it('follows a change of what it skips: newly skipped folders stop being watched, the ones no longer skipped are walked', async () => {
    let skipped = ['Library'];
    const { tree, watched } = setUp({ skip: (folder) => skipped.includes(folder) });
    await tree.start();

    skipped = ['src'];
    tree.followSkipRule();
    await tree.idle();
    expect(watched()).toEqual(['', 'Library', 'Library/Cache']);

    skipped = [];
    tree.followSkipRule();
    await tree.idle();
    expect(watched()).toEqual(['', 'Library', 'Library/Cache', 'src', 'src/deep']);
  });

  it('walks nothing that went away while it was skipped', async () => {
    let skipped = ['Library'];
    const { tree, watched, emit, at } = setUp({ skip: (folder) => skipped.includes(folder) });
    await tree.start();

    rmSync(at('Library'), { recursive: true });
    emit('', 'rename', 'Library');
    skipped = [];
    tree.followSkipRule();
    expect(watched()).toEqual(['', 'src', 'src/deep']);
  });

  it.skipIf(process.platform === 'win32')("doesn't follow links to folders, as cm doesn't", async () => {
    const { tree, watched, emit, at } = setUp();
    await tree.start();

    symlinkSync(at('Library'), at('src/linked'));
    emit('src', 'rename', 'linked');
    expect(watched()).not.toContain('src/linked');
  });

  it('is incomplete past its folder limit, having watched the upper folders first', async () => {
    const { tree, watched, at } = setUp({ maxFolders: 4 });
    mkdirSync(at('.plastic'));

    expect(await tree.start()).toBe(false);
    expect(watched()).toEqual(['', '.plastic', 'Library', 'src']);
  });

  it("is incomplete when a folder can't be watched, and has nothing without the root", async () => {
    expect(await setUp({ unwatchable: ['src/deep'] }).tree.start()).toBe(false);
    expect(await setUp({ unwatchable: [''] }).tree.start()).toBe(false);
  });

  it('drops a folder whose watch broke, and those under it, and tells', async () => {
    const { tree, watched, watches, at, timesBroken } = setUp();
    await tree.start();

    watches.break(at('src'));
    expect(watched()).toEqual(['', 'Library', 'Library/Cache']);
    expect(timesBroken()).toBe(1);
  });

  it("tells when a folder that appears can't be watched, but not about what start() already said", async () => {
    const { tree, emit, at, timesBroken } = setUp({ unwatchable: ['src/deep', 'new'] });
    expect(await tree.start()).toBe(false);
    expect(timesBroken()).toBe(0);

    mkdirSync(at('new'));
    emit('', 'rename', 'new');
    expect(timesBroken()).toBe(1);
  });

  it('lets every watch go once closed', async () => {
    const { tree, watched } = setUp();
    await tree.start();

    tree.close();
    expect(watched()).toEqual([]);
  });
});

describe('FolderTreeWatch walks the tree a step at a time, leaving the main process free in between', () => {
  it('watches the root at once, and answers start() once the tree is walked', async () => {
    const { tree, watched } = setUp();

    const started = tree.start();
    expect(watched()).toEqual(['']);
    expect(await started).toBe(true);
    expect(watched()).toEqual(['', 'Library', 'Library/Cache', 'src', 'src/deep']);
  });

  it('stops walking once closed meanwhile, and lets go of what it had watched', async () => {
    const { tree, watched, everWatched } = setUp({
      whenWatched: (folder, _path, tree) => folder === 'Library' && queueMicrotask(() => tree.close()),
    });

    expect(await tree.start()).toBe(false);
    await tree.idle();
    expect(watched()).toEqual([]);
    expect(everWatched()).toEqual(['', 'Library', 'src']);
  });

  it('catches a folder created while it walks, with everything inside it', async () => {
    const { tree, watched, emit, at } = setUp();

    const started = tree.start();
    mkdirSync(at('new/deeper'), { recursive: true });
    emit('', 'rename', 'new');
    expect(await started).toBe(true);
    await tree.idle();
    expect(watched()).toEqual(['', 'Library', 'Library/Cache', 'new', 'new/deeper', 'src', 'src/deep']);
  });

  it('watches nothing under a folder skipped since it was listed, and walks it once no longer skipped', async () => {
    let skipped: string[] = [];
    let skippedMidWalk = false;
    const { tree, watched } = setUp({
      skip: (folder) => skipped.includes(folder),
      whenWatched: (folder, _path, tree) => {
        if (folder !== 'src' || skippedMidWalk) return;
        skippedMidWalk = true;
        queueMicrotask(() => {
          skipped = ['src'];
          tree.followSkipRule();
        });
      },
    });

    expect(await tree.start()).toBe(true);
    expect(watched()).toEqual(['', 'Library', 'Library/Cache']);

    skipped = [];
    tree.followSkipRule();
    await tree.idle();
    expect(watched()).toEqual(['', 'Library', 'Library/Cache', 'src', 'src/deep']);
  });

  it('counts no loss for a folder deleted after it was listed', async () => {
    const { tree, watched } = setUp({
      whenWatched: (folder, path) => folder === 'src' && queueMicrotask(() => rmSync(join(path, 'deep'), { recursive: true })),
    });

    expect(await tree.start()).toBe(true);
    expect(watched()).toEqual(['', 'Library', 'Library/Cache', 'src']);
  });
});
