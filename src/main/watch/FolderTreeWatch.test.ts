import { mkdirSync, mkdtempSync, renameSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FolderTreeWatch } from './FolderTreeWatch';
import { fakeFolderWatches } from './testing/fakeFolderWatches';

/** A real folder tree (src/deep, Library/Cache) watched through fake watches the test fires. */
function setUp(options: { skip?: (folder: string) => boolean; maxFolders?: number; unwatchable?: string[] } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'folder-tree-'));
  mkdirSync(join(root, 'src', 'deep'), { recursive: true });
  mkdirSync(join(root, 'Library', 'Cache'), { recursive: true });
  const at = (folder: string): string => (folder ? join(root, ...folder.split('/')) : root);
  const watches = fakeFolderWatches((options.unwatchable ?? []).map((folder) => ({ path: at(folder) })));
  const events: string[] = [];
  const tree = new FolderTreeWatch(root, options.skip ?? (() => false), (event, path) => events.push(`${event} ${path}`), options.maxFolders ?? 100, watches.watch);
  /** The watched folders, workspace-relative and sorted. */
  const watched = (): string[] =>
    [...watches.watched().keys()].map((path) => (path === root ? '' : path.slice(root.length + 1).split(/[\\/]/).join('/'))).sort();
  return { root, tree, events, watched, at, emit: (folder: string, event: 'rename' | 'change', name: string | null) => watches.emit(at(folder), event, name), watches };
}

describe('FolderTreeWatch', () => {
  it('watches each folder of the tree with a plain watch, and reports items by their workspace-relative path', () => {
    const { tree, watched, emit, events, watches } = setUp();

    expect(tree.start()).toBe(true);
    expect(watched()).toEqual(['', 'Library', 'Library/Cache', 'src', 'src/deep']);
    expect([...watches.watched().values()].every((recursive) => !recursive)).toBe(true);

    emit('src/deep', 'change', 'app.ts');
    emit('', 'change', 'README.md');
    expect(events).toEqual(['change src/deep/app.ts', 'change README.md']);
  });

  it('keeps watching a folder whose file was saved by replacing it', () => {
    const { tree, watched, emit, events } = setUp();
    tree.start();

    emit('src/deep', 'rename', 'app.ts');
    emit('src/deep', 'change', 'app.ts');
    expect(watched()).toContain('src/deep');
    expect(events).toEqual(['rename src/deep/app.ts', 'change src/deep/app.ts']);
  });

  it('watches folders created after it started, with everything inside them', () => {
    const { tree, watched, emit, at } = setUp();
    tree.start();

    mkdirSync(at('new/deeper'), { recursive: true });
    emit('', 'rename', 'new');
    expect(watched()).toEqual(expect.arrayContaining(['new', 'new/deeper']));
  });

  it('follows a folder moved elsewhere in the tree: the old paths go, the new ones are watched', () => {
    const { tree, watched, emit, at } = setUp();
    tree.start();

    renameSync(at('src/deep'), at('Library/deep'));
    emit('src', 'rename', 'deep');
    emit('Library', 'rename', 'deep');
    expect(watched()).toEqual(['', 'Library', 'Library/Cache', 'Library/deep', 'src']);
  });

  it('stops watching a deleted folder and everything that was under it', () => {
    const { tree, watched, emit, at } = setUp();
    tree.start();

    rmSync(at('src'), { recursive: true });
    emit('', 'rename', 'src');
    expect(watched()).toEqual(['', 'Library', 'Library/Cache']);
  });

  it('never walks skipped folders, even when they appear later', () => {
    const { tree, watched, emit, at } = setUp({ skip: (folder) => folder === 'Library' || folder.endsWith('/obj') });
    tree.start();
    expect(watched()).toEqual(['', 'src', 'src/deep']);

    mkdirSync(at('src/obj'));
    emit('src', 'rename', 'obj');
    expect(watched()).toEqual(['', 'src', 'src/deep']);
  });

  it.skipIf(process.platform === 'win32')("doesn't follow links to folders, as cm doesn't", () => {
    const { tree, watched, emit, at } = setUp();
    tree.start();

    symlinkSync(at('Library'), at('src/linked'));
    emit('src', 'rename', 'linked');
    expect(watched()).not.toContain('src/linked');
  });

  it('is incomplete past its folder limit, having watched the upper folders first', () => {
    const { tree, watched, at } = setUp({ maxFolders: 4 });
    mkdirSync(at('.plastic'));

    expect(tree.start()).toBe(false);
    expect(watched()).toEqual(['', '.plastic', 'Library', 'src']);
  });

  it("is incomplete when a folder can't be watched, and has nothing without the root", () => {
    expect(setUp({ unwatchable: ['src/deep'] }).tree.start()).toBe(false);
    expect(setUp({ unwatchable: [''] }).tree.start()).toBe(false);
  });

  it('drops a folder whose watch broke, and those under it', () => {
    const { tree, watched, watches, at } = setUp();
    tree.start();

    watches.break(at('src'));
    expect(watched()).toEqual(['', 'Library', 'Library/Cache']);
  });

  it('lets every watch go once closed', () => {
    const { tree, watched } = setUp();
    tree.start();

    tree.close();
    expect(watched()).toEqual([]);
  });
});
