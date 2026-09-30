import { mkdir, mkdtemp, readFile, readlink, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'vitest';
import { change, pendingStatus } from '../cm/testing/cmOutput';
import { fakeCmClient } from '../cm/testing/fakeCmClient';
import { detachReplacedFiles } from './detachReplacedFiles';

const replaced = (path: string, revisionType: 'enTextFile' | 'enSymLink', type = 'RP'): string => pendingStatus(change(type, path, { revisionType }));

/** A `cm` whose undo puts back the loaded revision with `undo`; `argsAsked` are the arguments of each command, in order. */
function fakeCm(status: string, undo: () => Promise<void>) {
  const fake = fakeCmClient({
    status,
    undo: async () => {
      await undo();
      return '';
    },
    checkout: '',
    add: '',
  });
  return { cm: fake.cm, argsAsked: () => fake.commands.map((command) => command.args) };
}

// Concurrent: each test has its own folder and fake, and each waits out a real second (`waitForNextSecond`).
describe.concurrent('detachReplacedFiles', () => {
  it('writes the shelved text back in a later second than the undo wrote the loaded one, so cm sees the change', async ({ expect }) => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'uvcs-detach-'));
    const file = join(workspacePath, 'a.txt');
    await writeFile(file, 'teh\n');
    let undoneAtSecond = -1;
    const { cm, argsAsked } = fakeCm(replaced('a.txt', 'enTextFile'), async () => {
      // Like cm: the loaded revision, as many bytes as the shelved text.
      await writeFile(file, 'the\n');
      undoneAtSecond = Math.floor((await stat(file)).mtimeMs / 1000);
    });

    await detachReplacedFiles(cm, workspacePath);

    expect(argsAsked().map(([command]) => command)).toEqual(['status', 'undo', 'checkout']);
    expect(await readFile(file, 'utf8')).toBe('teh\n');
    expect(Math.floor((await stat(file)).mtimeMs / 1000)).toBeGreaterThan(undoneAtSecond);
  });

  it('adds back a file the shelve copied over a deletion, so nothing reads its revision once the shelve is deleted', async ({ expect }) => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'uvcs-detach-'));
    const file = join(workspacePath, 'src', 'f5.txt');
    await mkdir(join(workspacePath, 'src'));
    await writeFile(file, 'kept over the deletion\n');
    // Like cm: undoing the copy takes the file off the disk.
    const { cm, argsAsked } = fakeCm(replaced('src/f5.txt', 'enTextFile', 'CO+CP'), () => rm(file));

    await detachReplacedFiles(cm, workspacePath);

    expect(await readFile(file, 'utf8')).toBe('kept over the deletion\n');
    expect(argsAsked().slice(1)).toEqual([
      ['undo', file, '--symlink'],
      ['add', file],
    ]);
  });

  // Windows lets only administrators and Developer Mode create links.
  it.skipIf(process.platform === 'win32')('keeps a link pointing where the shelve left it, never touching the file it points to', async ({ expect }) => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'uvcs-detach-'));
    const link = join(workspacePath, 'link');
    await writeFile(join(workspacePath, 'README.md'), 'readme\n');
    await writeFile(join(workspacePath, 'NOTES.md'), 'notes\n');
    await symlink('NOTES.md', link);
    const { cm, argsAsked } = fakeCm(replaced('link', 'enSymLink'), async () => {
      await rm(link);
      await symlink('README.md', link);
    });

    await detachReplacedFiles(cm, workspacePath);

    expect(await readlink(link)).toBe('NOTES.md');
    expect(await readFile(join(workspacePath, 'README.md'), 'utf8')).toBe('readme\n');
    expect(await readFile(join(workspacePath, 'NOTES.md'), 'utf8')).toBe('notes\n');
    expect(argsAsked().slice(1)).toEqual([
      ['undo', link, '--symlink'],
      ['checkout', link, '--symlink'],
    ]);
  });
});
