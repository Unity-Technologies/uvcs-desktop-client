import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { formatOutput, UNITY_ORGANIZATION } from '../cm/testing/cmOutput';
import { cmFails, fakeCmClient, optionValue, type CmAnswer } from '../cm/testing/fakeCmClient';
import { contentHashOf } from '../files/WorkspaceCopies';
import { createContentService } from './contentService';
import { createHistoryService } from './historyService';
import { serviceContext } from './testing/serviceContext';

vi.mock('electron', () => ({ dialog: {}, shell: {} }));

const WORKSPACE = join(tmpdir(), 'wkspaces', 'game');
const README = join(WORKSPACE, 'README.md');

const revision = (changeset: number, itemId = '7', server = 'local'): string => `
  <Revision>
    <RevisionSpec>README.md#cs:${changeset}</RevisionSpec>
    <Branch>/main</Branch>
    <CreationDate>2026-09-25T09:40:43+02:00</CreationDate>
    <RevisionType>txt</RevisionType>
    <ChangesetNumber>${changeset}</ChangesetNumber>
    <Owner>ana</Owner>
    <Comment>Change ${changeset}</Comment>
    <Repository>game</Repository>
    <Server>${server}</Server>
    <RepositorySpec><Server>${server}</Server><Name>game</Name></RepositorySpec>
    <ItemId>${itemId}</ItemId>
    <Size>42</Size>
  </Revision>`;

const historyXml = (revisions: string): string => `<?xml version="1.0" encoding="utf-8"?>
<RevisionHistoriesResult><RevisionHistories><RevisionHistory>
  <ItemName>${README}</ItemName>
  <Revisions>${revisions}</Revisions>
</RevisionHistory></RevisionHistories></RevisionHistoriesResult>`;

function history(answers: Record<string, CmAnswer>) {
  const fake = fakeCmClient(answers);
  return { ...fake, service: createHistoryService(serviceContext(fake.cm), { apps: {} as never }) };
}

const TWO_REVISIONS: Record<string, CmAnswer> = {
  history: historyXml(revision(1) + revision(4)),
  'find revision': formatOutput([1, 15, -1], [4, 45, 15]),
};

describe('file history', () => {
  it("names a Unity organization's revisions as cm does everywhere else, though cm history --xml prints its id", async () => {
    const { service, lines } = history({
      history: historyXml(revision(1, '7', UNITY_ORGANIZATION.byId) + revision(4, '7', UNITY_ORGANIZATION.byId)),
      'find revision': formatOutput([1, 15, -1], [4, 45, 15]),
      ls: formatOutput([45, `rep:game@${UNITY_ORGANIZATION.byName}`]),
    });

    const itemHistory = await service.forItem(WORKSPACE, 'README.md');

    expect(itemHistory.revisions.map((item) => [item.repository, item.idSpec])).toEqual([
      ['game@AcmeStudio@unity', 'revid:45@game@AcmeStudio@unity'],
      ['game@AcmeStudio@unity', 'revid:15@game@AcmeStudio@unity'],
    ]);
    expect(lines().find((line) => line.startsWith('find revision'))).toContain("on repository 'game@AcmeStudio@unity'");
  });

  it("names a Unity organization's revisions after the revision the history starts from", async () => {
    const { service, lines } = history({
      history: historyXml(revision(1, '7', UNITY_ORGANIZATION.byId) + revision(4, '7', UNITY_ORGANIZATION.byId)),
      'find revision': formatOutput([1, 15, -1], [4, 45, 15]),
    });

    const itemHistory = await service.forItem(WORKSPACE, 'README.md', { revisionId: 45, repository: 'game@AcmeStudio@unity' });

    expect(itemHistory.revisions.map((item) => item.repository)).toEqual(['game@AcmeStudio@unity', 'game@AcmeStudio@unity']);
    expect(lines()).toHaveLength(2);
  });

  it("reads a workspace file's history with three quick commands: the history, its revision ids, and the one loaded", async () => {
    const { service, commands } = history({ ...TWO_REVISIONS, ls: formatOutput([45, 'rep:game@local', 'aGFzaA==', 42]) });

    const itemHistory = await service.forItem(WORKSPACE, 'README.md');

    expect(commands.map(({ via, args }) => [via, args])).toEqual([
      ['query', ['ls', README, '--format={revid}\u001f{repspec}\u001f{hash}\u001f{size}\u001e', '--symlink']],
      ['query', ['history', README, '--moveddeleted', '--xml', '--symlink']],
      ['query', ['find', 'revision', "where itemid = 7 on repository 'game@local'", '--format={changeset}\u001f{id}\u001f{parent}\u001e', '--nototal']],
    ]);
    expect(itemHistory.revisions.map((item) => [item.changesetId, item.revisionId, item.parentRevisionId])).toEqual([
      [4, 45, 15],
      [1, 15, -1],
    ]);
    expect(itemHistory.workspaceRevisionId).toBe(45);
  });

  it("reads a revision's item by its id in its repository, which the workspace may not have", async () => {
    const { service, lines } = history(TWO_REVISIONS);

    const itemHistory = await service.forItem(WORKSPACE, 'README.md', { revisionId: 45, repository: 'lib@local' });

    expect(lines()[0]).toBe('history rev:revid:45@lib@local --moveddeleted --xml --symlink');
    expect(lines().some((line) => line.startsWith('ls'))).toBe(false);
    expect(itemHistory.workspaceRevisionId).toBeUndefined();
  });

  it("shows the history when the workspace can't tell its loaded revision", async () => {
    const { service } = history({ ...TWO_REVISIONS, ls: cmFails('Error: The item README.md is not in the workspace.') });

    const itemHistory = await service.forItem(WORKSPACE, 'README.md');

    expect(itemHistory.revisions).toHaveLength(2);
    expect(itemHistory.workspaceRevisionId).toBeUndefined();
  });

  it('asks for no revision ids when the history has no revisions', async () => {
    const { service, lines } = history({ history: historyXml(''), ls: '' });

    expect((await service.forItem(WORKSPACE, 'README.md')).revisions).toEqual([]);
    expect(lines().some((line) => line.startsWith('find'))).toBe(false);
  });
});

describe("the workspace's revision in a history", () => {
  it('is read from the disk where the workspace holds it unchanged, and downloaded once it changed', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'history-wk-'));
    await writeFile(join(workspace, 'README.md'), '# Game\n');
    const fake = fakeCmClient({ ...TWO_REVISIONS, ls: formatOutput([45, 'rep:game@local', contentHashOf(Buffer.from('# Game\n')), 7]), cat: async ({ args }) => (await writeFile(optionValue(args, '--file=')!, 'downloaded'), '') });
    const context = serviceContext(fake.cm);
    await createHistoryService(context, { apps: {} as never }).forItem(workspace, 'README.md');
    const content = createContentService(context);
    const workspaceRevision = { kind: 'revision' as const, revision: { revisionId: 45, repository: 'game@local' }, fileName: 'README.md' };

    expect((await content.read(workspace, workspaceRevision)).text).toBe('# Game\n');
    expect(fake.ran('cat')).toBe(false);

    await writeFile(join(workspace, 'README.md'), '# Gamf\n');
    expect((await content.read(workspace, workspaceRevision)).text).toBe('downloaded');
    expect(fake.ran('cat revid:45@game@local')).toBe(true);
  });

  it("downloads the history's other revisions with no listing of the file's folder: the history's cm ls said what the workspace holds there", async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'history-wk-'));
    await writeFile(join(workspace, 'README.md'), '# Game\n');
    const fake = fakeCmClient({ ...TWO_REVISIONS, ls: formatOutput([45, 'rep:game@local', contentHashOf(Buffer.from('# Game\n')), 7]), cat: async ({ args }) => (await writeFile(optionValue(args, '--file=')!, 'older'), '') });
    const context = serviceContext(fake.cm);
    await createHistoryService(context, { apps: {} as never }).forItem(workspace, 'README.md');
    const listedBefore = fake.lines().filter((line) => line.startsWith('ls')).length;

    await createContentService(context).read(workspace, { kind: 'revision', revision: { revisionId: 15, repository: 'game@local' }, fileName: 'README.md' });

    expect(fake.lines().filter((line) => line.startsWith('ls'))).toHaveLength(listedBefore);
    expect(fake.ran('cat revid:15@game@local')).toBe(true);
  });
});

describe("the workspace's revision in a cloud repository's history", () => {
  it("is read from the disk though cm history spells the repository's server as an id, and cm ls as the organization", async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'history-cloud-wk-'));
    await writeFile(join(workspace, 'README.md'), '# Game\n');
    const fake = fakeCmClient({ ...TWO_REVISIONS, ls: formatOutput([45, 'rep:3dtest/game@MyOrg@unity', contentHashOf(Buffer.from('# Game\n')), 7]) });
    const context = serviceContext(fake.cm);
    await createHistoryService(context, { apps: {} as never }).forItem(workspace, 'README.md');

    const read = await createContentService(context).read(workspace, { kind: 'revision', revision: { revisionId: 45, repository: '3dtest/game@1375488836673@cloud' }, fileName: 'README.md' });

    expect(read.text).toBe('# Game\n');
    expect(fake.ran('cat')).toBe(false);
  });
});

describe('revert', () => {
  it('reverts the file to its version in a changeset with one quick command', async () => {
    const { service, commands } = history({ revert: '' });

    await service.revertTo(WORKSPACE, 'README.md', 4);

    expect(commands).toMatchObject([{ via: 'query', args: ['revert', `${README}#cs:4`], options: { cwd: WORKSPACE } }]);
  });
});
