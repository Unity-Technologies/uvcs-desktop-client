import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CmClient } from '../cm/CmClient';
import { detachReplacedFiles } from './switchShelves';

const REPLACED = `<?xml version="1.0" encoding="utf-8"?><StatusOutput><WorkspaceStatus><Status><Changeset>1</Changeset></Status></WorkspaceStatus><Changes>
<Change><Type>RP</Type><Path>a.txt</Path><OldPath /><MergesInfo /><SimilarityPerUnit>0</SimilarityPerUnit><Size>4</Size><RevisionType>enTextFile</RevisionType><LastModified>2026-09-25T08:26:09+02:00</LastModified></Change>
</Changes></StatusOutput>`;

describe('detachReplacedFiles', () => {
  it('writes the shelved text back in a later second than the undo wrote the loaded one, so cm sees the change', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'uvcs-detach-'));
    const file = join(workspacePath, 'a.txt');
    await writeFile(file, 'teh\n');
    let undoneAtSecond = -1;
    const commands: string[] = [];
    const cm = {
      async query(args: string[]) {
        commands.push(args[0]!);
        if (args[0] === 'status') return REPLACED;
        if (args[0] === 'undo') {
          // Like cm: the loaded revision, as many bytes as the shelved text.
          await writeFile(file, 'the\n');
          undoneAtSecond = Math.floor((await stat(file)).mtimeMs / 1000);
        }
        return '';
      },
    } as unknown as CmClient;

    await detachReplacedFiles(cm, workspacePath);

    expect(commands).toEqual(['status', 'undo', 'checkout']);
    expect(await readFile(file, 'utf8')).toBe('teh\n');
    expect(Math.floor((await stat(file)).mtimeMs / 1000)).toBeGreaterThan(undoneAtSecond);
  });
});
