import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FolderTreeWatch } from './FolderTreeWatch';

// Real folders and the platform's own plain watches: inotify where this matters (Linux), FSEvents on a Mac.
const trees: FolderTreeWatch[] = [];
const roots: string[] = [];

function setUp(options: { skip?: (folder: string) => boolean; maxFolders?: number } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'folder-tree-'));
  roots.push(root);
  mkdirSync(join(root, 'src', 'deep'), { recursive: true });
  mkdirSync(join(root, 'Library', 'Cache'), { recursive: true });
  writeFileSync(join(root, 'src', 'deep', 'app.ts'), 'a');
  const paths = new Set<string>();
  const tree = new FolderTreeWatch(root, options.skip ?? (() => false), (_event, path) => path && paths.add(path), options.maxFolders ?? 100);
  trees.push(tree);
  const write = (path: string, text: string) => writeFileSync(join(root, ...path.split('/')), text);
  const seen = (path: string) => vi.waitFor(() => expect(paths).toContain(path), { timeout: 3000, interval: 20 });
  // FSEvents drops what happens while its stream starts, and events trail the writes a little.
  const settle = () => new Promise((resolve) => setTimeout(resolve, 300));
  return { root, tree, paths, write, seen, settle };
}

afterEach(() => {
  trees.splice(0).forEach((tree) => tree.close());
  roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }));
});

describe('FolderTreeWatch', () => {
  it('reports edits in nested folders by their workspace-relative path', async () => {
    const { tree, write, seen, settle } = setUp();
    expect(tree.start()).toBe(true);
    await settle();
    write('src/deep/app.ts', 'b');
    await seen('src/deep/app.ts');
  });

  it('keeps reporting a file saved by replacing it, save after save', async () => {
    const { root, tree, paths, write, seen, settle } = setUp();
    tree.start();
    await settle();
    for (const text of ['one', 'two', 'three']) {
      write('src/deep/app.ts.tmp', text);
      await settle();
      paths.clear();
      renameSync(join(root, 'src', 'deep', 'app.ts.tmp'), join(root, 'src', 'deep', 'app.ts'));
      await seen('src/deep/app.ts');
    }
  });

  it('watches folders created after it started, and folders moved in', async () => {
    const { root, tree, write, seen, settle } = setUp();
    tree.start();
    await settle();
    mkdirSync(join(root, 'new', 'deeper'), { recursive: true });
    await seen('new');
    await settle();
    write('new/deeper/file.txt', 'n');
    await seen('new/deeper/file.txt');
    // Windows won't move a folder while a watch is open inside it; it watches recursively itself, never with these.
    if (process.platform === 'win32') return;

    renameSync(join(root, 'new'), join(root, 'src', 'moved'));
    await seen('src/moved');
    await settle();
    write('src/moved/deeper/file.txt', 'm');
    await seen('src/moved/deeper/file.txt');
  });

  it('never walks skipped folders', async () => {
    const { tree, paths, write, seen, settle } = setUp({ skip: (folder) => folder === 'Library' });
    tree.start();
    await settle();
    write('Library/Cache/blob', 'x');
    write('src/deep/app.ts', 'c');
    await seen('src/deep/app.ts');
    await settle();
    expect([...paths].filter((path) => path.startsWith('Library/'))).toEqual([]);
  });

  it('is incomplete past its folder limit, and watches the upper folders first', async () => {
    const { root, tree, paths, write, seen, settle } = setUp({ maxFolders: 4 });
    mkdirSync(join(root, '.plastic'));
    expect(tree.start()).toBe(false);
    await settle();
    write('src/deep/app.ts', 'd');
    write('.plastic/plastic.selector', 's');
    await seen('.plastic/plastic.selector');
    await settle();
    expect(paths).not.toContain('src/deep/app.ts');
  });
});
