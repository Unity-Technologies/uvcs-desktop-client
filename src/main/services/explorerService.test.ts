import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fakeCmClient, type CmAnswer } from '../cm/testing/fakeCmClient';
import { contentHashOf } from '../files/WorkspaceCopies';
import { createContentService } from './contentService';
import { createExplorerService } from './explorerService';
import { serviceContext } from './testing/serviceContext';

const WORKSPACE = join(tmpdir(), 'wkspaces', 'game');

function explorer(answers: Record<string, CmAnswer>) {
  const fake = fakeCmClient(answers);
  return { ...fake, service: createExplorerService(serviceContext(fake.cm)) };
}

const LS_XML = `<?xml version="1.0" encoding="utf-8"?>
<LsResults><LsItems>
  <LsItem><Status>Controlled</Status><Name>.</Name><WkPath>src</WkPath><Type>dir</Type></LsItem>
  <LsItem><Status>Controlled</Status><Name>a.cs</Name><WkPath>src/a.cs</WkPath><Size>12</Size><Type>txt</Type>
    <Changeset>2</Changeset><Owner>ana</Owner><Checkout /><RevId>52</RevId><ParentRevId>37</ParentRevId><ItemId>36</ItemId>
    <Branch>/main</Branch><Date>2026-09-25T09:41:47+02:00</Date></LsItem>
</LsItems></LsResults>`;

const FILEINFO_XML = `<?xml version="1.0" encoding="utf-8"?>
<FileInfos><FileInfo><ServerPath>/src/a.cs</ServerPath><Status>Controlled</Status><RevisionChangeset>2</RevisionChangeset>
<Owner>ana</Owner><Hash>abc=</Hash><RepSpec>game@local</RepSpec><Changelist /></FileInfo></FileInfos>`;

describe('browsing the workspace', () => {
  it('lists a folder of the workspace with one quick cm ls, links as themselves', async () => {
    const { service, commands } = explorer({ ls: LS_XML });

    const items = await service.listDirectory(WORKSPACE, 'src');

    expect(commands).toMatchObject([{ via: 'query', args: ['ls', join(WORKSPACE, 'src'), '--xml', '--symlink'], options: { cwd: WORKSPACE } }]);
    expect(items.map((item) => [item.path, item.revisionId])).toEqual([['src/a.cs', 52]]);
  });

  it("keeps each item's hash in the main process: the windows have no use for it", async () => {
    const { service } = explorer({ ls: LS_XML.replace('<ItemId>36</ItemId>', '<ItemId>36</ItemId><Hash>aGFzaA==</Hash>') });

    const [item] = await service.listDirectory(WORKSPACE, 'src');

    expect(item).not.toHaveProperty('hash');
  });

  it("reads a revision Browse repository listed from the workspace's disk where it holds it unchanged", async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'browse-wk-'));
    await mkdir(join(workspace, 'src'));
    await writeFile(join(workspace, 'src', 'a.cs'), 'class A {}\n');
    const listed = LS_XML.replace('<WkPath>src/a.cs</WkPath>', '<WkPath>/src/a.cs</WkPath>').replace('<ItemId>36</ItemId>', `<ItemId>36</ItemId><Repository>rep:game@local</Repository><Hash>${contentHashOf(Buffer.from('class A {}\n'))}</Hash>`).replace('<Size>12</Size>', '<Size>11</Size>');
    const fake = fakeCmClient({ ls: listed });
    const context = serviceContext(fake.cm);
    await createExplorerService(context).listRepositoryDirectory(workspace, 12, 'src');

    const read = await createContentService(context).read(workspace, { kind: 'revision', revision: { revisionId: 52, repository: 'game@local' }, fileName: 'src/a.cs' });

    expect(read.text).toBe('class A {}\n');
    expect(fake.ran('cat')).toBe(false);
  });

  it("lists a folder of a changeset's tree by its repository path", async () => {
    const { service, lines } = explorer({ ls: LS_XML });

    await service.listRepositoryDirectory(WORKSPACE, 12, 'src');

    expect(lines()).toEqual(['ls /src --tree=cs:12 --xml']);
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
