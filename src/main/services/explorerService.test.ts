import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { workspacePlace } from '@shared/domain/place';
import { recordsOutput, statusHeader } from '../cm/testing/cmOutput';
import { fakeCmClient, type CmAnswer } from '../cm/testing/fakeCmClient';
import { TREE_ITEM_FORMAT, TREE_ITEMS } from '../cm/treeItems';
import { contentHashOf } from '../files/WorkspaceCopies';
import { cmHeaderReaders, WorkspaceHeaders } from '../workspace/WorkspaceHeaders';
import { createContentService } from './contentService';
import { createExplorerService } from './explorerService';
import { serviceContext } from './testing/serviceContext';

const WORKSPACE = join(tmpdir(), 'wkspaces', 'game');

function explorer(answers: Record<string, CmAnswer>) {
  const fake = fakeCmClient(answers);
  return { ...fake, service: createExplorerService(serviceContext(fake.cm, { headers: new WorkspaceHeaders(cmHeaderReaders(fake.cm)) })) };
}

const A_CS = {
  name: 'a.cs',
  wkpath: 'src/a.cs',
  size: 12,
  type: 'txt',
  changeset: 2,
  owner: 'ana',
  revid: 52,
  parentrevid: 37,
  itemid: 36,
  branch: '/main',
  'date:o': '2026-09-25T09:41:47.0000000+02:00',
} as const;

/** `cm ls src --format=TREE_ITEM_FORMAT`: the folder itself, then `a.cs` as `changed` changes it. */
const listing = (changed: Partial<Record<(typeof TREE_ITEMS.fields)[number], string | number>> = {}) =>
  recordsOutput(TREE_ITEMS, { name: '.', wkpath: 'src', type: 'dir', size: 0, revid: 1 }, { ...A_CS, ...changed });

const FILEINFO_XML = `<?xml version="1.0" encoding="utf-8"?>
<FileInfos><FileInfo><ServerPath>/src/a.cs</ServerPath><Status>Controlled</Status><RevisionChangeset>2</RevisionChangeset>
<Owner>ana</Owner><Hash>abc=</Hash><RepSpec>game@local</RepSpec><Changelist /></FileInfo></FileInfos>`;

describe('browsing the workspace', () => {
  it('lists a folder of the workspace with one quick cm ls, links as themselves', async () => {
    const { service, commands } = explorer({ ls: listing() });

    const items = await service.listDirectory(WORKSPACE, 'src');

    expect(commands).toMatchObject([{ via: 'query', args: ['ls', join(WORKSPACE, 'src'), TREE_ITEM_FORMAT, '--symlink'], options: { cwd: WORKSPACE } }]);
    expect(items.map((item) => [item.path, item.revisionId])).toEqual([['src/a.cs', 52]]);
  });

  it("keeps each item's hash in the main process: the windows have no use for it", async () => {
    const { service } = explorer({ ls: listing({ hash: 'aGFzaA==' }) });

    const [item] = await service.listDirectory(WORKSPACE, 'src');

    expect(item).not.toHaveProperty('hash');
  });

  it("reads a revision Browse repository listed from the workspace's disk where it holds it unchanged", async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'browse-wk-'));
    await mkdir(join(workspace, 'src'));
    await writeFile(join(workspace, 'src', 'a.cs'), 'class A {}\n');
    const listed = listing({ wkpath: '/src/a.cs', repspec: 'rep:game@local', hash: contentHashOf(Buffer.from('class A {}\n')), size: 11 });
    const fake = fakeCmClient({ ls: listed });
    const context = serviceContext(fake.cm);
    await createExplorerService(context).listRepositoryDirectory(workspace, 12, 'src');

    const read = await createContentService(context).read(workspacePlace(workspace), { kind: 'revision', revision: { revisionId: 52, repository: 'game@local' }, fileName: 'src/a.cs' });

    expect(read.text).toBe('class A {}\n');
    expect(fake.ran('cat')).toBe(false);
  });

  it("lists a folder of a changeset's tree by its repository path", async () => {
    const { service, lines } = explorer({ ls: listing() });

    await service.listRepositoryDirectory(WORKSPACE, 12, 'src');

    expect(lines()).toEqual([`ls /src --tree=cs:12 ${TREE_ITEM_FORMAT}`]);
  });

  it("reads an item's details with one quick cm fileinfo", async () => {
    const { service, commands } = explorer({ fileinfo: FILEINFO_XML });

    expect(await service.details(WORKSPACE, 'src/a.cs')).toMatchObject({ serverPath: '/src/a.cs', loadedChangeset: 2, repository: 'game@local' });
    expect(commands[0]?.args).toEqual(['fileinfo', join(WORKSPACE, 'src', 'a.cs'), '--xml', '--symlink']);
  });
});

describe('changing the workspace', () => {
  it('creates a file, with the folders typed along with its name, and adds it', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'explorer-wk-'));
    const { service, lines } = explorer({ add: '' });

    await service.create(workspace, 'docs/intro.md', 'file');

    expect(await readFile(join(workspace, 'docs', 'intro.md'), 'utf8')).toBe('');
    expect(lines()).toEqual([`add --coparent ${join(workspace, 'docs', 'intro.md')}`]);
  });

  it('creates and adds a folder', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'explorer-wk-'));
    const { service, lines } = explorer({ add: '' });

    await service.create(workspace, 'Assets', 'directory');

    expect(existsSync(join(workspace, 'Assets'))).toBe(true);
    expect(lines()).toEqual([`add --coparent ${join(workspace, 'Assets')}`]);
  });

  it('never overwrites a file that exists, and adds nothing then', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'explorer-wk-'));
    await writeFile(join(workspace, 'a.cs'), 'mine');
    const { service, commands } = explorer({ add: '' });

    await expect(service.create(workspace, 'a.cs', 'file')).rejects.toThrow();
    expect(await readFile(join(workspace, 'a.cs'), 'utf8')).toBe('mine');
    expect(commands).toEqual([]);
  });

  it('restores deleted items with one quick cm undelete each, which CmClient runs as a process: it downloads', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'explorer-wk-'));
    await mkdir(join(workspace, 'notes'));
    const { service, commands } = explorer({ 'status --header': statusHeader('/main', { repository: 'game' }), undelete: '' });

    const outcome = await service.restoreDeleted(
      workspace,
      [
        { revision: { revisionId: 24, repository: 'game@local' }, path: 'docs' },
        { revision: { revisionId: 16, repository: 'game@local' }, path: 'notes/Café menú.txt' },
      ],
      'op-1',
    );

    expect(commands.map(({ via, args }) => ({ via, args }))).toEqual([
      // The workspace's repository, a local read the window's info shares: cm finds the bare id only there.
      { via: 'query', args: ['status', '--header', '--xml'] },
      { via: 'query', args: ['undelete', 'revid:24', join(workspace, 'docs')] },
      { via: 'query', args: ['undelete', 'revid:16', join(workspace, 'notes', 'Café menú.txt')] },
    ]);
    expect(outcome).toEqual({ restored: 2, total: 2 });
  });

  it("refuses a revision of another repository than the workspace's, whatever the window asks", async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'explorer-wk-'));
    const { service, ran } = explorer({ 'status --header': statusHeader('/main', { repository: 'game' }) });

    const outcome = await service.restoreDeleted(workspace, [{ revision: { revisionId: 24, repository: 'thirdparty@local' }, path: 'lib' }], 'op-1');

    expect(outcome).toEqual({ restored: 0, total: 1, refused: expect.objectContaining({ kind: 'otherRepository', path: 'lib' }) });
    expect(ran('undelete')).toBe(false);
  });

  it('adds folders with everything in them, and changes revision types, with one command for all the items', async () => {
    const { service, lines } = explorer({ add: '', changerevisiontype: '' });

    await service.addRecursive(WORKSPACE, ['Assets', 'Docs']);
    await service.changeRevisionType(WORKSPACE, ['a.png', 'b.png'], 'bin');

    expect(lines()).toEqual([
      `add -R --coparent ${join(WORKSPACE, 'Assets')} ${join(WORKSPACE, 'Docs')}`,
      `changerevisiontype ${join(WORKSPACE, 'a.png')} ${join(WORKSPACE, 'b.png')} --type=bin`,
    ]);
  });
});
