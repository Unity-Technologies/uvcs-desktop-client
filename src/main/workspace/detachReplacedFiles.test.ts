import { mkdir, mkdtemp, readFile, readlink, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, vi } from 'vitest';
import { change, pendingStatus } from '../cm/testing/cmOutput';
import { fakeCmClient } from '../cm/testing/fakeCmClient';
import { waitForNextSecond } from '../files/nextSecond';
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

// Writing in a later second than `cm` is `waitForNextSecond`'s own guarantee (nextSecond.test.ts): here it would cost
// a real second a test. What matters here is when it waits: after the undo, before writing the files back.
vi.mock('../files/nextSecond', () => ({ waitForNextSecond: vi.fn(async () => {}) }));

describe('detachReplacedFiles', () => {
  it('writes the shelved text back in a later second than the undo wrote the loaded one, so cm sees the change', async ({ expect }) => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'uvcs-detach-'));
    const file = join(workspacePath, 'a.txt');
    await writeFile(file, 'teh\n');
    const steps: string[] = [];
    const { cm, argsAsked } = fakeCm(replaced('a.txt', 'enTextFile'), async () => {
      // Like cm: the loaded revision, as many bytes as the shelved text.
      await writeFile(file, 'the\n');
      steps.push('undo');
    });
    vi.mocked(waitForNextSecond).mockImplementationOnce(async () => {
      steps.push(`wait, the file reading ${JSON.stringify(await readFile(file, 'utf8'))}`);
    });

    await detachReplacedFiles(cm, workspacePath);

    expect(steps).toEqual(['undo', 'wait, the file reading "the\\n"']);
    expect(argsAsked().map(([command]) => command)).toEqual(['status', 'undo', 'checkout']);
    expect(await readFile(file, 'utf8')).toBe('teh\n');
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
