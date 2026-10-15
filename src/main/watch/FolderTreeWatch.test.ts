import { existsSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FOLDERS_PER_STEP, FolderTreeWatch, listSubfoldersOnDisk, type ListSubfolders } from './FolderTreeWatch';
import { fakeFolderWatches } from './testing/fakeFolderWatches';
import type { WatchFolder } from './watchFolder';

interface Options {
  /** The tree's folders, `/`-separated (src/deep and Library/Cache by default). */
  folders?: string[];
  skip?: (folder: string) => boolean;
  maxFolders?: number;
  unwatchable?: string[];
  /** Listings answer only when the test says (`listings`), else as the disk does. */
  holdListings?: boolean;
}

/**
 * Listings read from the disk when asked, and answered when the test says: the walk takes its steps when the test
 * chooses, whatever the disk's speed.
 */
function heldListings() {
  const unanswered: { folder: string; answer: () => void }[] = [];
  const waiting: { count: number; resolve: () => void }[] = [];
  let holding = true;
  const tellWaiting = (): void => {
    for (const waiter of waiting.filter(({ count }) => unanswered.length >= count)) {
      waiting.splice(waiting.indexOf(waiter), 1);
      waiter.resolve();
    }
  };
  const answer = (exceptFolder?: string): void => {
    const answering = unanswered.filter(({ folder }) => folder !== exceptFolder);
    for (const listing of answering) unanswered.splice(unanswered.indexOf(listing), 1);
    for (const listing of answering) listing.answer();
  };
  const list: ListSubfolders = (folder) => {
    const names = readdirSync(folder, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    if (!holding) return Promise.resolve(names);
    return new Promise((resolve) => {
      unanswered.push({ folder, answer: () => resolve(names) });
      tellWaiting();
    });
  };
  return {
    list,
    /** Answers the listings asked so far (but that of `exceptFolder`, an absolute path). */
    answer,
    /** Answers the listings asked so far, and every one from now on at once. */
    answerAll: (): void => {
      holding = false;
      answer();
    },
    /** Resolves once `count` listings wait for their answer. */
    asked: (count: number): Promise<void> =>
      new Promise((resolve) => {
        waiting.push({ count, resolve });
        tellWaiting();
      }),
  };
}

/**
 * A real folder tree watched through fake watches the test fires. As with `fs.watch`, a folder that doesn't exist
 * can't be watched.
 */
function setUp(options: Options = {}) {
  const root = mkdtempSync(join(tmpdir(), 'folder-tree-'));
  for (const folder of options.folders ?? ['src/deep', 'Library/Cache']) mkdirSync(join(root, ...folder.split('/')), { recursive: true });
  const at = (folder: string): string => (folder ? join(root, ...folder.split('/')) : root);
  const relative = (path: string): string => (path === root ? '' : path.slice(root.length + 1).split(/[\\/]/).join('/'));
  const watches = fakeFolderWatches((options.unwatchable ?? []).map((folder) => ({ path: at(folder) })));
  const everWatched: string[] = [];
  const watch: WatchFolder = (path, recursive, onEvent) => {
    if (!existsSync(path)) throw Object.assign(new Error(`ENOENT: no such file or directory, watch '${path}'`), { code: 'ENOENT' });
    const folderWatch = watches.watch(path, recursive, onEvent);
    everWatched.push(relative(path));
    return folderWatch;
  };
  const listings = heldListings();
  const events: string[] = [];
  let broken = 0;
  const tree = new FolderTreeWatch(
    root,
    options.skip ?? (() => false),
    (event, path) => events.push(`${event} ${path}`),
    () => broken++,
    options.maxFolders ?? 100,
    watch,
    options.holdListings ? listings.list : listSubfoldersOnDisk,
  );
  return {
    root,
    tree,
    events,
    listings,
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
    await tree.walksDone();
    expect(watched()).toEqual(expect.arrayContaining(['new', 'new/deeper']));
  });

  it('follows a folder moved elsewhere in the tree: the old paths go, the new ones are watched', async () => {
    const { tree, watched, emit, at } = setUp();
    await tree.start();

    renameSync(at('src/deep'), at('Library/deep'));
    emit('src', 'rename', 'deep');
    emit('Library', 'rename', 'deep');
    await tree.walksDone();
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
    await tree.walksDone();
    expect(watched()).toEqual(['', 'src', 'src/deep']);
  });

  it('follows a change of what it skips: newly skipped folders stop being watched, the ones no longer skipped are walked', async () => {
    let skipped = ['Library'];
    const { tree, watched } = setUp({ skip: (folder) => skipped.includes(folder) });
    await tree.start();

    skipped = ['src'];
    tree.followSkipRule();
    await tree.walksDone();
    expect(watched()).toEqual(['', 'Library', 'Library/Cache']);

    skipped = [];
    tree.followSkipRule();
    await tree.walksDone();
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

  it(`watches ${FOLDERS_PER_STEP} folders at most before waiting for their listings`, async () => {
    const folders = Array.from({ length: 100 }, (_, index) => `folder${index}`);
    const { tree, watched, listings } = setUp({ folders, maxFolders: 1000, holdListings: true });

    const started = tree.start();
    expect(watched()).toHaveLength(1);
    listings.answer();
    await listings.asked(FOLDERS_PER_STEP);
    expect(watched()).toHaveLength(1 + FOLDERS_PER_STEP);
    listings.answer();
    await listings.asked(100 - FOLDERS_PER_STEP);
    expect(watched()).toHaveLength(101);
    listings.answer();
    expect(await started).toBe(true);
  });

  it('stops walking once closed meanwhile, and lets go of what it had watched', async () => {
    const { tree, watched, everWatched, listings } = setUp({ holdListings: true });
    const started = tree.start();
    listings.answer();
    await listings.asked(2);

    tree.close();
    listings.answerAll();
    expect(await started).toBe(false);
    expect(watched()).toEqual([]);
    expect(everWatched()).toEqual(['', 'Library', 'src']);
  });

  it('catches a folder created while it walks, with everything inside it', async () => {
    const { tree, watched, emit, at, listings } = setUp({ holdListings: true });
    const started = tree.start();

    mkdirSync(at('new/deeper'), { recursive: true });
    emit('', 'rename', 'new');
    listings.answerAll();
    expect(await started).toBe(true);
    await tree.walksDone();
    expect(watched()).toEqual(['', 'Library', 'Library/Cache', 'new', 'new/deeper', 'src', 'src/deep']);
  });

  it('watches nothing under a folder skipped since it was listed, and walks it once no longer skipped', async () => {
    let skipped: string[] = [];
    const { tree, watched, listings } = setUp({ skip: (folder) => skipped.includes(folder), holdListings: true });
    const started = tree.start();
    listings.answer();
    await listings.asked(2);

    skipped = ['src'];
    tree.followSkipRule();
    listings.answerAll();
    expect(await started).toBe(true);
    expect(watched()).toEqual(['', 'Library', 'Library/Cache']);

    skipped = [];
    tree.followSkipRule();
    await tree.walksDone();
    expect(watched()).toEqual(['', 'Library', 'Library/Cache', 'src', 'src/deep']);
  });

  it('counts no loss for a folder deleted after it was listed', async () => {
    const { tree, watched, at, listings } = setUp({ holdListings: true });
    const started = tree.start();
    listings.answer();
    await listings.asked(2);

    rmSync(at('src/deep'), { recursive: true });
    listings.answerAll();
    expect(await started).toBe(true);
    expect(watched()).toEqual(['', 'Library', 'Library/Cache', 'src']);
  });
});
