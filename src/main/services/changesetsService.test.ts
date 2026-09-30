import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findXml } from '../cm/testing/cmOutput';
import { fakeCmClient, type CmAnswer } from '../cm/testing/fakeCmClient';
import { createChangesetsService } from './changesetsService';
import { serviceContext } from './testing/serviceContext';

const WORKSPACE = join(tmpdir(), 'wkspaces', 'game');

function changesetRecord(id: number, repository = 'game') {
  return {
    ID: id + 100,
    CHANGESETID: id,
    COMMENT: `Change ${id}`,
    DATE: '2026-09-25T10:00:00+02:00',
    OWNER: 'ana',
    BRANCH: '/main/task1',
    PARENT: id - 1,
    REPNAME: repository,
    REPSERVER: 'local',
    GUID: `guid-${id}`,
  };
}

function changesets(answers: Record<string, CmAnswer>) {
  const fake = fakeCmClient(answers);
  return { ...fake, service: createChangesetsService(serviceContext(fake.cm)) };
}

describe('changesets', () => {
  it('lists changesets newest first with one cm find, filtered on the server', async () => {
    const { service, commands } = changesets({ 'find changeset': findXml('CHANGESET', changesetRecord(12), changesetRecord(11)) });

    const listed = await service.list(WORKSPACE, { branch: '/main/task1', sinceDate: '2026-09-01', limit: 100 });

    expect(commands).toMatchObject([
      {
        via: 'query',
        args: ['find', 'changeset', "where date >= '2026-09-01' and branch = '/main/task1' order by changesetid desc limit 100", '--xml', '--nototal'],
        options: { cwd: WORKSPACE },
      },
    ]);
    expect(listed.map((changeset) => [changeset.id, changeset.parent, changeset.repository])).toEqual([
      [12, 11, 'game@local'],
      [11, 10, 'game@local'],
    ]);
  });

  it('reads one changeset, in another repository when it names one (an xlinked item)', async () => {
    const { service, lines } = changesets({ 'find changeset': findXml('CHANGESET', changesetRecord(7, 'lib')) });

    await service.get(WORKSPACE, 7);
    const xlinked = await service.get(WORKSPACE, 7, "lib's@local");

    expect(lines()).toEqual([
      'find changeset where changesetid = 7 --xml --nototal',
      "find changeset where changesetid = 7 on repository 'lib''s@local' --xml --nototal",
    ]);
    expect(xlinked.repository).toBe('lib@local');
  });

  it("fails for a changeset that doesn't exist", async () => {
    const { service } = changesets({ 'find changeset': findXml('CHANGESET') });

    await expect(service.get(WORKSPACE, 7)).rejects.toThrow('Changeset 7 was not found.');
  });

  it('edits the comment, moves and deletes a changeset with one quick command each', async () => {
    const { service, commands } = changesets({ changeset: '' });

    await service.editComment(WORKSPACE, 7, 'Better words');
    await service.moveToBranch(WORKSPACE, 7, '/main/task2');
    await service.remove(WORKSPACE, 7);

    expect(commands.map(({ via, args }) => [via, args])).toEqual([
      ['query', ['changeset', 'editcomment', 'cs:7', 'Better words']],
      ['query', ['changeset', 'move', 'cs:7', 'br:/main/task2']],
      ['query', ['changeset', 'delete', 'cs:7']],
    ]);
  });
});
