import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { recordsOutput } from '../cm/testing/cmOutput';
import { TREE_ITEM_FORMAT, TREE_ITEMS } from '../cm/treeItems';
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
    await saveContent(cm, workspacePlace(workspace), { kind: 'workspaceBase', path: 'readme.md' }, join(workspace, 'out'));
    expect(lines()).toEqual([`cat ${join(workspace, 'readme.md')} --file=${join(workspace, 'out')}`]);
  });

  it('finds a file gone from disk through its folder, without a failing cm cat first', async () => {
    const { cm, lines } = fakeCm(false);
    await saveContent(cm, workspacePlace(workspace), { kind: 'workspaceBase', path: 'docs/readme.md' }, join(workspace, 'out'));
    expect(lines()).toEqual([`fileinfo ${join(workspace, 'docs')} ${join(workspace, 'docs', 'readme.md')} --xml`, `cat serverpath:/docs/readme.md#cs:3@game@local --file=${join(workspace, 'out')}`]);
  });

  it('still reads by its path a file gone from disk that its folder does not tell', async () => {
    const { cm, lines } = fakeCmClient({ fileinfo: cmFails('not found'), cat: '' });
    await saveContent(cm, workspacePlace(workspace), { kind: 'workspaceBase', path: 'docs/readme.md' }, join(workspace, 'out'));
    expect(lines()).toEqual([`fileinfo ${join(workspace, 'docs')} ${join(workspace, 'docs', 'readme.md')} --xml`, `cat ${join(workspace, 'docs', 'readme.md')} --file=${join(workspace, 'out')}`]);
  });
});

const XLINKED = '/plugins/editor-plugin/Tests/DiffWindowMockExtensions.cs';

/** `cm ls <XLINKED> --tree=cs:278738 --format=TREE_ITEM_FORMAT`: the file is the editorGUI repository's, under the editor-plugin xlink. */
const XLINKED_LISTING = recordsOutput(TREE_ITEMS, { name: 'DiffWindowMockExtensions.cs', wkpath: XLINKED, type: 'txt', size: 40, repspec: 'rep:editorGUI@acme@cloud', revid: 432251 });

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
    await saveContent(cm, workspacePlace(tmpdir()), { kind: 'revision', revision: { revisionId: 432251, repository: 'editorGUI@acme@cloud' }, fileName: 'a.cs' }, 'out');
    expect(lines()).toEqual(['cat revid:432251@editorGUI@acme@cloud --file=out']);
  });
});

describe('saveContent of a repository path', () => {
  it('reads a path of the repository at a changeset', async () => {
    const { cm, lines } = xlinkingCm();
    await saveContent(cm, workspacePlace(tmpdir()), { kind: 'repositoryPath', path: '/src/app.ts', at: 'cs:12' }, 'out');
    expect(lines()).toEqual(['cat serverpath:/src/app.ts#cs:12 --file=out']);
  });

  it("reads a path under an xlink as the revision the changeset's tree has there, in the xlinked repository", async () => {
    const { cm, lines } = xlinkingCm();
    await saveContent(cm, workspacePlace(tmpdir()), { kind: 'repositoryPath', path: XLINKED, at: 'cs:278738' }, 'out');
    expect(lines()).toEqual([`cat serverpath:${XLINKED}#cs:278738 --file=out`, `ls ${XLINKED} --tree=cs:278738 ${TREE_ITEM_FORMAT}`, 'cat revid:432251@editorGUI@acme@cloud --file=out']);
  });

  it("reads a path under an xlink at a branch's head as the revision the branch's tree has there", async () => {
    const { cm, lines } = xlinkingCm();
    await saveContent(cm, workspacePlace(tmpdir()), { kind: 'repositoryPath', path: XLINKED, at: 'br:/main' }, 'out');
    expect(lines()).toEqual([`cat serverpath:${XLINKED}#br:/main --file=out`, `ls ${XLINKED} --tree=br:/main ${TREE_ITEM_FORMAT}`, 'cat revid:432251@editorGUI@acme@cloud --file=out']);
  });

  it("fails as cm does for a shelve's path, whose tree can't be listed", async () => {
    const { cm, lines } = xlinkingCm();
    await expect(saveContent(cm, workspacePlace(tmpdir()), { kind: 'repositoryPath', path: XLINKED, at: 'sh:3' }, 'out')).rejects.toThrow('not found');
    expect(lines()).toEqual([`cat serverpath:${XLINKED}#sh:3 --file=out`]);
  });
});

const SHARED_BIN = '/Assets/Shared/Models/scene.bin';

/** `cm ls /Assets/Shared/Models/scene.bin --tree=cs:3 --format=TREE_ITEM_FORMAT`, as cm prints it: the game repository xlinks art at Assets/Shared. */
const SHARED_BIN_LISTING = recordsOutput(TREE_ITEMS, {
  name: 'scene.bin',
  wkpath: '/Assets/Shared/Models/scene.bin',
  type: 'txt',
  size: 7,
  'date:o': '2026-10-13T17:43:58.0000000+02:00',
  changeset: 1,
  branch: '/main',
  owner: 'ana@unity3d.com',
  revid: 14,
  parentrevid: -1,
  repspec: 'rep:art@local',
  itemid: 19,
  hash: 'RMZaMUglHwroxMQj6yytRw==',
});

describe('saveContent of a repository path known to be under an xlink', () => {
  /** A `cm` where `serverpath:` finds nothing under the Assets/Shared xlink, as the real one. */
  function sharedArtCm() {
    return fakeCmClient({
      ls: SHARED_BIN_LISTING,
      cat: ({ args }) => (args[1]!.startsWith('serverpath:') ? cmFails(`The specified revision was not found ${args[1]}`) : ''),
    });
  }

  it.each(['cs:3', 'br:/main'])("reads it from the tree at %s at once: one quick cm ls, then its revision in the xlinked repository, no failing cm cat first", async (at) => {
    const { cm, commands } = sharedArtCm();
    await saveContent(cm, workspacePlace(tmpdir()), { kind: 'repositoryPath', path: SHARED_BIN, at, repository: 'art@local' }, 'out');
    expect(commands.map(({ via, line }) => `${via}: ${line}`)).toEqual([`query: ls ${SHARED_BIN} --tree=${at} ${TREE_ITEM_FORMAT}`, 'query: cat revid:14@art@local --file=out']);
  });

  it("fails as cm does when the tree hasn't the path", async () => {
    const { cm } = fakeCmClient({ ls: cmFails(`Can't resolve the selector for the item ${SHARED_BIN}`) });
    await expect(saveContent(cm, workspacePlace(tmpdir()), { kind: 'repositoryPath', path: SHARED_BIN, at: 'cs:3', repository: 'art@local' }, 'out')).rejects.toThrow("Can't resolve the selector");
  });

  it("asks cm nothing at a shelve, whose tree cm ls can't list and whose server paths don't reach through an xlink", async () => {
    const { cm, lines } = sharedArtCm();
    await expect(saveContent(cm, workspacePlace(tmpdir()), { kind: 'repositoryPath', path: SHARED_BIN, at: 'sh:2', repository: 'art@local' }, 'out')).rejects.toThrow('under an xlink');
    expect(lines()).toEqual([]);
  });
});

describe('saveContent in a repository explored without a workspace', () => {
  const onRepository = repositoryPlace('acme@acme@cloud');

  it('names the repository on a path and on the tree it falls back to, outside every workspace', async () => {
    const { cm, lines, commands } = xlinkingCm();
    await saveContent(cm, onRepository, { kind: 'repositoryPath', path: XLINKED, at: 'cs:278738' }, 'out');
    expect(lines()).toEqual([
      `cat serverpath:${XLINKED}#cs:278738@acme@acme@cloud --file=out`,
      `ls ${XLINKED} --tree=cs:278738@acme@acme@cloud ${TREE_ITEM_FORMAT}`,
      'cat revid:432251@editorGUI@acme@cloud --file=out',
    ]);
    expect(commands.every(({ options }) => options.outsideWorkspaces)).toBe(true);
  });

  it("keeps a revision's own repository, the xlinked one it was read from", async () => {
    const { cm, lines } = xlinkingCm();
    await saveContent(cm, onRepository, { kind: 'revision', revision: { revisionId: 432251, repository: 'editorGUI@acme@cloud' }, fileName: 'a.cs' }, 'out');
    expect(lines()).toEqual(['cat revid:432251@editorGUI@acme@cloud --file=out']);
  });

  it('never reads a workspace file: there is none, and asking is a bug told as one', async () => {
    const { cm, commands } = xlinkingCm();
    await expect(saveContent(cm, onRepository, { kind: 'workspaceFile', path: 'a.cs' }, 'out')).rejects.toThrow('needs a workspace');
    await expect(saveContent(cm, onRepository, { kind: 'workspaceBase', path: 'a.cs' }, 'out')).rejects.toThrow('needs a workspace');
    expect(commands).toEqual([]);
  });
});
