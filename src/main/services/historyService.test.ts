import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { formatOutput } from '../cm/testing/cmOutput';
import { cmFails, fakeCmClient, type CmAnswer } from '../cm/testing/fakeCmClient';
import { createHistoryService } from './historyService';
import { serviceContext } from './testing/serviceContext';

vi.mock('electron', () => ({ dialog: {}, shell: {} }));

const WORKSPACE = join(tmpdir(), 'wkspaces', 'game');
const README = join(WORKSPACE, 'README.md');

const revision = (changeset: number, itemId = '7'): string => `
  <Revision>
    <RevisionSpec>README.md#cs:${changeset}</RevisionSpec>
    <Branch>/main</Branch>
    <CreationDate>2026-09-25T09:40:43+02:00</CreationDate>
    <RevisionType>txt</RevisionType>
    <ChangesetNumber>${changeset}</ChangesetNumber>
    <Owner>ana</Owner>
    <Comment>Change ${changeset}</Comment>
    <Repository>game</Repository>
    <Server>local</Server>
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
  return { ...fake, service: createHistoryService(serviceContext(fake.cm)) };
}

const TWO_REVISIONS: Record<string, CmAnswer> = {
  history: historyXml(revision(1) + revision(4)),
  'find revision': formatOutput([1, 15, -1], [4, 45, 15]),
};

describe('file history', () => {
  it("reads a workspace file's history with three quick commands: the history, its revision ids, and the one loaded", async () => {
    const { service, commands } = history({ ...TWO_REVISIONS, ls: '45\n' });

    const itemHistory = await service.forItem(WORKSPACE, 'README.md');

    expect(commands.map(({ via, args }) => [via, args])).toEqual([
      ['query', ['ls', README, '--format={revid}', '--symlink']],
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

describe('revert', () => {
  it('reverts the file to its version in a changeset with one quick command', async () => {
    const { service, commands } = history({ revert: '' });

    await service.revertTo(WORKSPACE, 'README.md', 4);

    expect(commands).toMatchObject([{ via: 'query', args: ['revert', `${README}#cs:4`], options: { cwd: WORKSPACE } }]);
  });
});
