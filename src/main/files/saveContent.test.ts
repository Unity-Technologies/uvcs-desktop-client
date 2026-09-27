import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CmClient } from '../cm/CmClient';
import { saveContent } from './saveContent';

const FILEINFO = `<?xml version="1.0" encoding="utf-8"?><FileInfos>
<FileInfo><ServerPath>/docs</ServerPath><RepSpec>game@local</RepSpec><IsXlink>false</IsXlink></FileInfo>
<FileInfo><ServerPath>/docs/readme.md</ServerPath><RevisionChangeset>3</RevisionChangeset><RepSpec>game@local</RepSpec></FileInfo>
</FileInfos>`;

/** A `cm` that knows the loaded revision of `docs/readme.md` by its path only while `resolvesPath`. */
function fakeCm(resolvesPath: boolean) {
  const commands: string[] = [];
  const cm = {
    async query(args: string[]) {
      commands.push(args[0] === 'cat' ? `cat ${args[1]}` : args[0]!);
      if (args[0] === 'fileinfo') return FILEINFO;
      if (args[0] === 'cat' && (args[1]!.startsWith('serverpath:') || resolvesPath)) return '';
      throw new Error('The specified revision was not found');
    },
  } as unknown as CmClient;
  return { cm, commands };
}

describe('saveContent of the loaded revision', () => {
  let workspace: string;
  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), 'uvcs-save-'));
  });
  afterEach(() => rmSync(workspace, { recursive: true, force: true }));

  it('reads a file on disk by its path', async () => {
    writeFileSync(join(workspace, 'readme.md'), 'edited');
    const { cm, commands } = fakeCm(true);
    await saveContent(cm, workspace, { kind: 'workspaceBase', path: 'readme.md' }, join(workspace, 'out'));
    expect(commands).toEqual([`cat ${join(workspace, 'readme.md')}`]);
  });

  it('finds a file gone from disk through its folder, without a failing cm cat first', async () => {
    const { cm, commands } = fakeCm(false);
    await saveContent(cm, workspace, { kind: 'workspaceBase', path: 'docs/readme.md' }, join(workspace, 'out'));
    expect(commands).toEqual(['fileinfo', 'cat serverpath:/docs/readme.md#cs:3@game@local']);
  });

  it('still reads by its path a file gone from disk that its folder does not tell', async () => {
    const { cm, commands } = fakeCm(true);
    cm.query = (async (args: string[]) => {
      commands.push(args[0] === 'cat' ? `cat ${args[1]}` : args[0]!);
      if (args[0] === 'fileinfo') throw new Error('not found');
      return '';
    }) as CmClient['query'];
    await saveContent(cm, workspace, { kind: 'workspaceBase', path: 'docs/readme.md' }, join(workspace, 'out'));
    expect(commands).toEqual(['fileinfo', `cat ${join(workspace, 'docs', 'readme.md')}`]);
  });
});
