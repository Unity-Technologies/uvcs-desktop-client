import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { findQueryArgs, roundTripDate } from '../cm/findQuery';
import { FOUND_CHANGESETS } from '../cm/foundObjects';
import { foundLine, recordsOutput } from '../cm/testing/cmOutput';
import { fakeCmClient, type CmAnswer } from '../cm/testing/fakeCmClient';
import { createChangesetsService } from './changesetsService';
import { serviceContext } from './testing/serviceContext';

const WORKSPACE = join(tmpdir(), 'wkspaces', 'game');

function changesetRecord(id: number, repository = 'game') {
  return {
    changesetid: id,
    comment: `Change ${id}`,
    date: '2026-09-25T10:00:00+02:00',
    owner: 'ana',
    branch: '/main/task1',
    parent: id - 1,
    repname: repository,
    repserver: 'local',
    guid: `guid-${id}`,
  };
}

function changesets(answers: Record<string, CmAnswer>) {
  const fake = fakeCmClient(answers);
  return { ...fake, service: createChangesetsService(serviceContext(fake.cm)) };
}

const IN_WORKSPACE = workspacePlace(WORKSPACE);

describe('changesets', () => {
  it('lists changesets newest first with one cm find, filtered on the server', async () => {
    const { service, commands } = changesets({ 'find changeset': recordsOutput(FOUND_CHANGESETS, changesetRecord(12), changesetRecord(11)) });

    const listed = await service.list(IN_WORKSPACE, { branch: '/main/task1', sinceDate: '2026-09-01', limit: 100 });

    expect(commands).toMatchObject([
      {
        via: 'query',
        args: findQueryArgs(
          FOUND_CHANGESETS,
          `where ignorehidden = 'true' and date >= '${roundTripDate('2026-09-01')}' and branch = '/main/task1' order by changesetid desc limit 100`,
        ),
        options: { cwd: WORKSPACE },
        readsRecords: true,
      },
    ]);
    expect(listed.map((changeset) => [changeset.id, changeset.parent, changeset.repository])).toEqual([
      [12, 11, 'game@local'],
      [11, 10, 'game@local'],
    ]);
  });

  // `cm find changeset` leaves a hidden branch's changesets out unless `ignorehidden` brings them in: a branch asked
  // for by name shows its changesets, hidden or not; the list of every branch keeps hidden branches out.
  it("lists a branch's changesets whether the branch is hidden or not, and every branch's without hidden ones", async () => {
    const { service, lines } = changesets({ 'find changeset': '' });

    await service.list(IN_WORKSPACE, { branch: '/main/to-hide' });
    await service.list(IN_WORKSPACE, { sinceDate: '2026-09-01' });

    expect(lines()).toEqual([
      foundLine(FOUND_CHANGESETS, "where ignorehidden = 'true' and branch = '/main/to-hide' order by changesetid desc"),
      foundLine(FOUND_CHANGESETS, `where date >= '${roundTripDate('2026-09-01')}' order by changesetid desc`),
    ]);
  });

  it('asks for nested and non-ASCII branch names as written', async () => {
    const { service, lines } = changesets({ 'find changeset': '' });

    await service.list(IN_WORKSPACE, { branch: '/main/características-del-niño/日本語のブランチ名-テスト', limit: 2000 });

    expect(lines()).toEqual([
      foundLine(FOUND_CHANGESETS, "where ignorehidden = 'true' and branch = '/main/características-del-niño/日本語のブランチ名-テスト' order by changesetid desc limit 2000"),
    ]);
  });

  it('reads one changeset, in another repository when it names one (an xlinked item)', async () => {
    const { service, lines } = changesets({ 'find changeset': recordsOutput(FOUND_CHANGESETS, changesetRecord(7, 'lib')) });

    await service.get(IN_WORKSPACE, 7);
    const xlinked = await service.get(IN_WORKSPACE, 7, 'lib@local');

    expect(lines()).toEqual([
      foundLine(FOUND_CHANGESETS, 'where changesetid = 7'),
      foundLine(FOUND_CHANGESETS, "where changesetid = 7 on repository 'lib@local'"),
    ]);
    expect(xlinked.repository).toBe('lib@local');
  });

  it("fails for a changeset that doesn't exist", async () => {
    const { service } = changesets({ 'find changeset': '' });

    await expect(service.get(IN_WORKSPACE, 7)).rejects.toThrow('Changeset 7 was not found.');
  });

  it('edits the comment, moves and deletes a changeset with one quick command each', async () => {
    const { service, commands } = changesets({ changeset: '' });

    await service.editComment(IN_WORKSPACE, 7, 'Better words');
    await service.moveToBranch(IN_WORKSPACE, 7, '/main/task2');
    await service.remove(IN_WORKSPACE, 7);

    expect(commands.map(({ via, args }) => [via, args])).toEqual([
      ['query', ['changeset', 'editcomment', 'cs:7', 'Better words']],
      ['query', ['changeset', 'move', 'cs:7', 'br:/main/task2']],
      ['query', ['changeset', 'delete', 'cs:7']],
    ]);
  });
});

describe('changesets of a repository explored without a workspace', () => {
  const ON_REPOSITORY = repositoryPlace('game@local');
  const OUTSIDE = { outsideWorkspaces: true };

  it("finds another repository's changeset for a comment's chip with one find: quick on the place's server, in a process of its own on another", async () => {
    const { cm, commands } = fakeCmClient({ 'find changeset': recordsOutput(FOUND_CHANGESETS, changesetRecord(4)) });
    const service = createChangesetsService(serviceContext(cm));

    expect(await service.find(repositoryPlace('lib@acme@cloud'), 4)).toMatchObject({ id: 4 });
    await service.find(repositoryPlace('game@far.example.com:8087'), 4, { ownProcess: true });

    expect(commands.map(({ via, args }) => [via, args[2]])).toEqual([
      ['query', "where changesetid = 4 on repository 'lib@acme@cloud'"],
      ['execute', "where changesetid = 4 on repository 'game@far.example.com:8087'"],
    ]);
  });

  it('finds no changeset by a number the repository has none of, as an answer, not a failure', async () => {
    const { cm } = fakeCmClient({ 'find changeset': recordsOutput(FOUND_CHANGESETS) });
    expect(await createChangesetsService(serviceContext(cm)).find(repositoryPlace('codice@codice@cloud'), 280528)).toBeNull();
  });

  it('lists and reads them naming the repository, an xlinked one when asked, outside every workspace', async () => {
    const { cm, commands } = fakeCmClient({ 'find changeset': recordsOutput(FOUND_CHANGESETS, changesetRecord(7)) });
    const service = createChangesetsService(serviceContext(cm));

    await service.list(ON_REPOSITORY, { branch: '/main/task1', limit: 100 });
    await service.get(ON_REPOSITORY, 7);
    await service.get(ON_REPOSITORY, 7, 'lib@local');

    expect(commands.map(({ args, options }) => [args[2], options])).toEqual([
      ["where ignorehidden = 'true' and branch = '/main/task1' order by changesetid desc limit 100 on repository 'game@local'", OUTSIDE],
      ["where changesetid = 7 on repository 'game@local'", OUTSIDE],
      ["where changesetid = 7 on repository 'lib@local'", OUTSIDE],
    ]);
  });

  it('edits the comment, moves and deletes naming the repository on every spec', async () => {
    const { cm, lines, commands } = fakeCmClient({ changeset: '' });
    const service = createChangesetsService(serviceContext(cm));

    await service.editComment(ON_REPOSITORY, 7, 'Better words');
    await service.moveToBranch(ON_REPOSITORY, 7, '/main/task2');
    await service.remove(ON_REPOSITORY, 7);

    expect(lines()).toEqual([
      'changeset editcomment cs:7@game@local Better words',
      'changeset move cs:7@game@local br:/main/task2@game@local',
      'changeset delete cs:7@game@local',
    ]);
    expect(commands.every(({ options }) => options.outsideWorkspaces)).toBe(true);
  });
});
