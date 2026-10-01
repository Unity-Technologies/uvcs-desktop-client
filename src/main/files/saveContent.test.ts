import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cmFails, fakeCmClient } from '../cm/testing/fakeCmClient';
import { saveContent } from './saveContent';

const FILEINFO = `<?xml version="1.0" encoding="utf-8"?><FileInfos>
<FileInfo><ServerPath>/docs</ServerPath><RepSpec>game@local</RepSpec><IsXlink>false</IsXlink></FileInfo>
<FileInfo><ServerPath>/docs/readme.md</ServerPath><RevisionChangeset>3</RevisionChangeset><RepSpec>game@local</RepSpec></FileInfo>
</FileInfos>`;

/** A `cm` that knows the loaded revision of `docs/readme.md` by its path only while `resolvesPath`. */
function fakeCm(resolvesPath: boolean) {
  return fakeCmClient({
    fileinfo: FILEINFO,
    cat: ({ args }) => (args[1]!.startsWith('serverpath:') || resolvesPath ? '' : cmFails('The specified revision was not found')),
  });
}

describe('saveContent of the loaded revision', () => {
  let workspace: string;
  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), 'uvcs-save-'));
  });
  afterEach(() => rmSync(workspace, { recursive: true, force: true }));

  it('reads a file on disk by its path', async () => {
    writeFileSync(join(workspace, 'readme.md'), 'edited');
    const { cm, lines } = fakeCm(true);
    await saveContent(cm, workspace, { kind: 'workspaceBase', path: 'readme.md' }, join(workspace, 'out'));
    expect(lines()).toEqual([`cat ${join(workspace, 'readme.md')} --file=${join(workspace, 'out')}`]);
  });

  it('finds a file gone from disk through its folder, without a failing cm cat first', async () => {
    const { cm, lines } = fakeCm(false);
    await saveContent(cm, workspace, { kind: 'workspaceBase', path: 'docs/readme.md' }, join(workspace, 'out'));
    expect(lines()).toEqual([`fileinfo ${join(workspace, 'docs')} ${join(workspace, 'docs', 'readme.md')} --xml`, `cat serverpath:/docs/readme.md#cs:3@game@local --file=${join(workspace, 'out')}`]);
  });

  it('still reads by its path a file gone from disk that its folder does not tell', async () => {
    const { cm, lines } = fakeCmClient({ fileinfo: cmFails('not found'), cat: '' });
    await saveContent(cm, workspace, { kind: 'workspaceBase', path: 'docs/readme.md' }, join(workspace, 'out'));
    expect(lines()).toEqual([`fileinfo ${join(workspace, 'docs')} ${join(workspace, 'docs', 'readme.md')} --xml`, `cat ${join(workspace, 'docs', 'readme.md')} --file=${join(workspace, 'out')}`]);
  });
});

const XLINKED = '/plugins/editor-plugin/Tests/DiffWindowMockExtensions.cs';

/** `cm ls <XLINKED> --tree=cs:278738 --xml`: the file is the editorGUI repository's, under the editor-plugin xlink. */
const XLINKED_LISTING = `<LsResults><LsItems><LsItem><Status>Controlled</Status><Name>DiffWindowMockExtensions.cs</Name>
  <WkPath>${XLINKED}</WkPath><Type>txt</Type><Repository>rep:editorGUI@acme@cloud</Repository><RevId>432251</RevId></LsItem></LsItems></LsResults>`;

/** A `cm` whose repository tree has an xlink at `/plugins/editor-plugin`: `serverpath:` finds nothing under it. */
function xlinkingCm() {
  return fakeCmClient({
    ls: XLINKED_LISTING,
    cat: ({ args }) => (args[1]!.startsWith('serverpath:/plugins/editor-plugin/') ? cmFails('The specified revision was not found') : ''),
  });
}

describe('saveContent of a revision', () => {
  it('reads it by its id in its repository, never a bare id the workspace would look up in its own', async () => {
    const { cm, lines } = xlinkingCm();
    await saveContent(cm, tmpdir(), { kind: 'revision', revision: { revisionId: 432251, repository: 'editorGUI@acme@cloud' }, fileName: 'a.cs' }, 'out');
    expect(lines()).toEqual(['cat revid:432251@editorGUI@acme@cloud --file=out']);
  });
});

describe('saveContent of a repository path', () => {
  it('reads a path of the repository at a changeset', async () => {
    const { cm, lines } = xlinkingCm();
    await saveContent(cm, tmpdir(), { kind: 'repositoryPath', path: '/src/app.ts', at: 'cs:12' }, 'out');
    expect(lines()).toEqual(['cat serverpath:/src/app.ts#cs:12 --file=out']);
  });

  it("reads a path under an xlink as the revision the changeset's tree has there, in the xlinked repository", async () => {
    const { cm, lines } = xlinkingCm();
    await saveContent(cm, tmpdir(), { kind: 'repositoryPath', path: XLINKED, at: 'cs:278738' }, 'out');
    expect(lines()).toEqual([`cat serverpath:${XLINKED}#cs:278738 --file=out`, `ls ${XLINKED} --tree=cs:278738 --xml`, 'cat revid:432251@editorGUI@acme@cloud --file=out']);
  });

  it("fails as cm does for a shelve's path, whose tree can't be listed", async () => {
    const { cm, lines } = xlinkingCm();
    await expect(saveContent(cm, tmpdir(), { kind: 'repositoryPath', path: XLINKED, at: 'sh:3' }, 'out')).rejects.toThrow('not found');
    expect(lines()).toEqual([`cat serverpath:${XLINKED}#sh:3 --file=out`]);
  });
});
