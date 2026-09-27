import { mkdtemp, readFile, readlink, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CmClient } from '../cm/CmClient';
import { detachReplacedFiles } from './switchShelves';

const replaced = (path: string, revisionType: string): string => `<?xml version="1.0" encoding="utf-8"?><StatusOutput><WorkspaceStatus><Status><Changeset>1</Changeset></Status></WorkspaceStatus><Changes>
<Change><Type>RP</Type><Path>${path}</Path><OldPath /><MergesInfo /><SimilarityPerUnit>0</SimilarityPerUnit><Size>4</Size><RevisionType>${revisionType}</RevisionType><LastModified>2026-09-25T08:26:09+02:00</LastModified></Change>
</Changes></StatusOutput>`;

/** A `cm` whose undo puts back the loaded revision with `undo`, and that records the commands. */
function fakeCm(status: string, undo: () => Promise<void>) {
  const commands: string[][] = [];
  const cm = {
    async query(args: string[]) {
      commands.push(args);
      if (args[0] === 'status') return status;
      if (args[0] === 'undo') await undo();
      return '';
    },
  } as unknown as CmClient;
  return { cm, commands };
}

describe('detachReplacedFiles', () => {
  it('writes the shelved text back in a later second than the undo wrote the loaded one, so cm sees the change', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'uvcs-detach-'));
    const file = join(workspacePath, 'a.txt');
    await writeFile(file, 'teh\n');
    let undoneAtSecond = -1;
    const { cm, commands } = fakeCm(replaced('a.txt', 'enTextFile'), async () => {
      // Like cm: the loaded revision, as many bytes as the shelved text.
      await writeFile(file, 'the\n');
      undoneAtSecond = Math.floor((await stat(file)).mtimeMs / 1000);
    });

    await detachReplacedFiles(cm, workspacePath);

    expect(commands.map(([command]) => command)).toEqual(['status', 'undo', 'checkout']);
    expect(await readFile(file, 'utf8')).toBe('teh\n');
    expect(Math.floor((await stat(file)).mtimeMs / 1000)).toBeGreaterThan(undoneAtSecond);
  });

  it('keeps a link pointing where the shelve left it, never touching the file it points to', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'uvcs-detach-'));
    const link = join(workspacePath, 'link');
    await writeFile(join(workspacePath, 'README.md'), 'readme\n');
    await writeFile(join(workspacePath, 'NOTES.md'), 'notes\n');
    await symlink('NOTES.md', link);
    const { cm, commands } = fakeCm(replaced('link', 'enSymLink'), async () => {
      await rm(link);
      await symlink('README.md', link);
    });

    await detachReplacedFiles(cm, workspacePath);

    expect(await readlink(link)).toBe('NOTES.md');
    expect(await readFile(join(workspacePath, 'README.md'), 'utf8')).toBe('readme\n');
    expect(await readFile(join(workspacePath, 'NOTES.md'), 'utf8')).toBe('notes\n');
    expect(commands.slice(1)).toEqual([
      ['undo', link, '--symlink'],
      ['checkout', link, '--symlink'],
    ]);
  });
});
