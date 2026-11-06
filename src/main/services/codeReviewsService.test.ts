import { MAX_LISTED_CODE_REVIEWS } from '@shared/domain/codeReview';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { BranchNamesCache } from '../cm/BranchNamesCache';
import { readBranchNames } from '../cm/branchNames';
import { FOUND_REVIEWS } from '../cm/codeReviewRecords';
import { findQueryArgs, roundTripDate } from '../cm/findQuery';
import { formatOutput, foundLine, recordsOutput } from '../cm/testing/cmOutput';
import { fakeCmClient, type CmAnswer } from '../cm/testing/fakeCmClient';
import { createCodeReviewsService } from './codeReviewsService';
import { readingFileOption } from './testing/readingFileOption';
import { serviceContext } from './testing/serviceContext';

const WORKSPACE = join(tmpdir(), 'wkspaces', 'game');
const IN_WORKSPACE = workspacePlace(WORKSPACE);

function review(id: number, targetType: string, target: string) {
  return {
    id: id,
    title: `Review ${id}`,
    codereviewstatusname: 'Under review',
    owner: 'ana',
    reviewers: 'bob:Under review',
    date: '2026-09-25T10:00:00+02:00',
    modifieddate: '2026-09-26T10:00:00+02:00',
    comments: 3,
    unresolvedissues: 1,
    targettype: targetType,
    target: target,
  };
}

const ON_TASK1 = review(5, 'Branch', 'id:37');
const ON_CHANGESET = review(6, 'Changeset', '120');
const ON_SHELVE = review(7, 'Shelve', '3');
const ON_DELETED_BRANCH = review(8, 'Branch', 'id:99');

/** Wired as `createServices` wires them: branch names come from the cache, which reads every branch only when it must. */
function codeReviews(answers: Record<string, CmAnswer>) {
  const fake = fakeCmClient(answers);
  const branchNames = new BranchNamesCache((place) => readBranchNames(fake.cm, place));
  return { ...fake, branchNames, service: createCodeReviewsService(serviceContext(fake.cm), { branchNames }) };
}

const EVERY_BRANCH_NAME: Record<string, CmAnswer> = {
  'find branch': ({ line }) => (line.includes("hidden = 'true'") ? formatOutput(['21', '/main/old']) : formatOutput(['37', '/main/task1'])),
};

describe('code review list', () => {
  it('lists the newest reviews with one cm find, filtered on the server', async () => {
    const { service, commands } = codeReviews({ 'find review': recordsOutput(FOUND_REVIEWS, ON_CHANGESET) });

    await service.list(IN_WORKSPACE, { reviewerIsMe: true, status: 'Reviewed', owners: ['ana'], sinceDate: '2026-09-01', text: 'fix' });

    expect(commands).toMatchObject([
      {
        via: 'query',
        args: findQueryArgs(
          FOUND_REVIEWS,
          `where reviewer = 'me' and status = 'Reviewed' and title like '%ix%' and date >= '${roundTripDate('2026-09-01')}' and owner = 'ana' order by date desc limit 300`,
        ),
        options: { cwd: WORKSPACE },
      },
    ]);
  });

  it('names each target: changesets and shelves by number, branches by the names of every branch, read once', async () => {
    const { service, lines } = codeReviews({
      'find review': recordsOutput(FOUND_REVIEWS, ON_TASK1, ON_CHANGESET, ON_SHELVE, ON_DELETED_BRANCH),
      ...EVERY_BRANCH_NAME,
    });

    const reviews = await service.list(IN_WORKSPACE, {});

    expect(reviews.map((listed) => listed.target)).toEqual([
      { kind: 'branch', branch: '/main/task1' },
      { kind: 'changeset', changesetId: 120 },
      { kind: 'shelve', shelveId: 3 },
      { kind: 'unknown', description: 'an unknown branch' },
    ]);
    expect(lines().filter((line) => line.startsWith('find branch'))).toHaveLength(2);

    await service.list(IN_WORKSPACE, {});
    expect(lines().filter((line) => line.startsWith('find branch'))).toHaveLength(2);
  });

  it('asks nothing more when the branch lists already read name every target', async () => {
    const { service, branchNames, lines } = codeReviews({ 'find review': recordsOutput(FOUND_REVIEWS, ON_TASK1) });
    branchNames.remember(IN_WORKSPACE, [{ id: 37, name: '/main/task1' }]);

    const [listed] = await service.list(IN_WORKSPACE, {});

    expect(listed?.target).toEqual({ kind: 'branch', branch: '/main/task1' });
    expect(lines()).toEqual([foundLine(FOUND_REVIEWS, 'order by date desc limit 300')]);
  });

  it('lists summaries with branch targets by id, never reading branch names', async () => {
    const { service, lines } = codeReviews({ 'find review': recordsOutput(FOUND_REVIEWS, ON_TASK1, ON_CHANGESET) });

    const summaries = await service.listSummaries(IN_WORKSPACE, {});

    expect(summaries.map((summary) => summary.targetBranchId)).toEqual([37, undefined]);
    expect(lines()).toHaveLength(1);
  });

  it('names the changeset and shelve targets of summaries from the same records, a branch only by its id', async () => {
    const { service, lines } = codeReviews({ 'find review': recordsOutput(FOUND_REVIEWS, ON_TASK1, ON_CHANGESET, ON_SHELVE) });

    const summaries = await service.listSummaries(IN_WORKSPACE, {});

    expect(summaries.map((summary) => summary.target)).toEqual([undefined, { kind: 'changeset', changesetId: 120 }, { kind: 'shelve', shelveId: 3 }]);
    expect(lines()).toHaveLength(1);
  });
});

describe('one code review', () => {
  it('reads a review by id', async () => {
    const { service, lines } = codeReviews({ 'find review': recordsOutput(FOUND_REVIEWS, ON_CHANGESET) });

    expect(await service.get(IN_WORKSPACE, 6)).toMatchObject({ id: 6, title: 'Review 6', status: 'Under review', target: { kind: 'changeset' } });
    expect(lines()).toEqual([foundLine(FOUND_REVIEWS, 'where id = 6 order by date desc')]);
  });

  it("fails for a review that doesn't exist", async () => {
    const { service } = codeReviews({ 'find review': '' });

    await expect(service.get(IN_WORKSPACE, 6)).rejects.toThrow('Code review 6 was not found.');
  });
});

describe('code review writes', () => {
  it('creates a review asking its reviewers in the same command, and returns its id', async () => {
    const { service, commands } = codeReviews({ codereview: '42\n' });

    expect(await service.create(IN_WORKSPACE, { targetSpec: 'br:/main/task1', title: 'Jump', reviewers: ['bob', ' eva ', ''] })).toBe(42);
    expect(commands).toMatchObject([{ via: 'query', args: ['codereview', 'br:/main/task1', 'Jump', '--users=bob,eva', '--format={id}'] }]);
  });

  it('creates a review asking nobody', async () => {
    const { service, lines } = codeReviews({ codereview: '42\n' });

    await service.create(IN_WORKSPACE, { targetSpec: 'cs:12', title: 'Jump', reviewers: [] });

    expect(lines()).toEqual(['codereview cs:12 Jump --format={id}']);
  });

  it('asks several reviewers with one command', async () => {
    const { service, commands } = codeReviews({ 'codereview reviewer add': '' });

    await service.addReviewers(IN_WORKSPACE, 6, ['bob', 'eva']);

    expect(commands).toMatchObject([{ via: 'query', args: ['codereview', 'reviewer', 'add', '6', '--users=bob,eva'] }]);
  });

  it.each([
    ['Reviewed', '--reviewed'],
    ['Rework required', '--rework-required'],
    ['Under review', '--under-review'],
  ] as const)('sets your own status %s with %s', async (status, option) => {
    const { service, lines } = codeReviews({ 'codereview review': '' });

    await service.setOwnStatus(IN_WORKSPACE, 6, status);

    expect(lines()).toEqual([`codereview review 6 ${option}`]);
  });

  it('says why in a file deleted afterwards, as the comment may hold lines', async () => {
    const { seen, answer } = readingFileOption('-commentsfile=');
    const { service, commands } = codeReviews({ 'codereview review': answer });

    await service.setOwnStatus(IN_WORKSPACE, 6, 'Rework required', 'Two changes\nbefore it goes in.');

    expect(commands).toMatchObject([{ via: 'query', args: ['codereview', 'review', '6', '--rework-required', `-commentsfile=${seen.file}`] }]);
    expect(seen.content).toBe('Two changes\nbefore it goes in.');
    expect(existsSync(seen.file)).toBe(false);
  });

  it('writes no file for a comment that says nothing', async () => {
    const { service, lines } = codeReviews({ 'codereview review': '' });

    await service.setOwnStatus(IN_WORKSPACE, 6, 'Reviewed', '  \n');

    expect(lines()).toEqual(['codereview review 6 --reviewed']);
  });

  it('deletes several reviews with one command', async () => {
    const { service, lines } = codeReviews({ 'codereview -d': '' });

    await service.remove(IN_WORKSPACE, [6, 7]);

    expect(lines()).toEqual(['codereview -d 6 7']);
  });
});

describe('code reviews of a repository explored without a workspace', () => {
  const ON_REPOSITORY = repositoryPlace('game@local');

  it('lists them and names their branches naming the repository, outside every workspace', async () => {
    const { service, commands } = codeReviews({ 'find review': recordsOutput(FOUND_REVIEWS, ON_TASK1), ...EVERY_BRANCH_NAME });

    const [listed] = await service.list(ON_REPOSITORY, {});

    expect(listed?.target).toEqual({ kind: 'branch', branch: '/main/task1' });
    expect(commands.map(({ args }) => args[2])).toEqual([
      `order by date desc limit ${MAX_LISTED_CODE_REVIEWS} on repository 'game@local'`,
      "on repository 'game@local'",
      "where hidden = 'true' on repository 'game@local'",
    ]);
    expect(commands.every(({ options }) => options.outsideWorkspaces)).toBe(true);
  });

  // Outside a workspace, `cm codereview` with no `--repository` fails ("Object reference not set…") after creating.
  it('creates, asks reviewers, sets a status and deletes with --repository, the target spec naming the repository too', async () => {
    const { service, lines } = codeReviews({ codereview: '42\n' });

    expect(await service.create(ON_REPOSITORY, { targetSpec: 'cs:12', title: 'Jump' })).toBe(42);
    await service.addReviewers(ON_REPOSITORY, 6, ['bob']);
    await service.setOwnStatus(ON_REPOSITORY, 6, 'Reviewed');
    await service.remove(ON_REPOSITORY, [6, 7]);

    expect(lines()).toEqual([
      'codereview cs:12@game@local Jump --format={id} --repository=game@local',
      'codereview reviewer add 6 --users=bob --repository=game@local',
      'codereview review 6 --reviewed --repository=game@local',
      'codereview -d 6 7 --repository=game@local',
    ]);
  });
});
