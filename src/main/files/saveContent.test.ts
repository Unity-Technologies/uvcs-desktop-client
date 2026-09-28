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

const XLINKED = '/plugins/unity-plugin/Tests/UnityDiffWindowMockExtensions.cs';

/** `cm ls <XLINKED> --tree=cs:278738 --xml`: the file is the unityGUI repository's, under the unity-plugin xlink. */
const XLINKED_LISTING = `<LsResults><LsItems><LsItem><Status>Controlled</Status><Name>UnityDiffWindowMockExtensions.cs</Name>
  <WkPath>${XLINKED}</WkPath><Type>txt</Type><Repository>rep:unityGUI@codice@cloud</Repository><RevId>432251</RevId></LsItem></LsItems></LsResults>`;

/** A `cm` whose repository tree has an xlink at `/plugins/unity-plugin`: `serverpath:` finds nothing under it. */
function xlinkingCm() {
  const commands: string[] = [];
  const cm = {
    async query(args: string[]) {
      commands.push(args.slice(0, args[0] === 'ls' ? 3 : 2).join(' '));
      if (args[0] === 'ls') return XLINKED_LISTING;
      if (args[1]!.startsWith('serverpath:/plugins/unity-plugin/')) throw new Error('The specified revision was not found');
      return '';
    },
  } as unknown as CmClient;
  return { cm, commands };
}

describe('saveContent of a revision', () => {
  it('reads it by its id in its repository, never a bare id the workspace would look up in its own', async () => {
    const { cm, commands } = xlinkingCm();
    await saveContent(cm, tmpdir(), { kind: 'revision', revision: { revisionId: 432251, repository: 'unityGUI@codice@cloud' }, fileName: 'a.cs' }, 'out');
    expect(commands).toEqual(['cat revid:432251@unityGUI@codice@cloud']);
  });
});

describe('saveContent of a repository path', () => {
  it('reads a path of the repository at a changeset', async () => {
    const { cm, commands } = xlinkingCm();
    await saveContent(cm, tmpdir(), { kind: 'repositoryPath', path: '/src/app.ts', at: 'cs:12' }, 'out');
    expect(commands).toEqual(['cat serverpath:/src/app.ts#cs:12']);
  });

  it("reads a path under an xlink as the revision the changeset's tree has there, in the xlinked repository", async () => {
    const { cm, commands } = xlinkingCm();
    await saveContent(cm, tmpdir(), { kind: 'repositoryPath', path: XLINKED, at: 'cs:278738' }, 'out');
    expect(commands).toEqual([`cat serverpath:${XLINKED}#cs:278738`, `ls ${XLINKED} --tree=cs:278738`, 'cat revid:432251@unityGUI@codice@cloud']);
  });

  it("fails as cm does for a shelve's path, whose tree can't be listed", async () => {
    const { cm, commands } = xlinkingCm();
    await expect(saveContent(cm, tmpdir(), { kind: 'repositoryPath', path: XLINKED, at: 'sh:3' }, 'out')).rejects.toThrow('not found');
    expect(commands).toEqual([`cat serverpath:${XLINKED}#sh:3`]);
  });
});
