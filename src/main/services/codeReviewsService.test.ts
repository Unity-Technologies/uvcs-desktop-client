import type { MemberRef } from '@shared/domain/member';
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
import { FIELD_SEPARATOR, RECORD_SEPARATOR } from '../cm/formatRecords';
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

const user = (name: string): MemberRef => ({ name, kind: 'user' });
const group = (name: string): MemberRef => ({ name, kind: 'group' });

const EVERY_BRANCH_NAME: Record<string, CmAnswer> = {
  'find branch': ({ line }) => (line.includes("hidden = 'true'") ? formatOutput(['21', '/main/old']) : formatOutput(['37', '/main/task1'])),
};

describe('code review list', () => {
  it('lists every review the filters keep with one cm find, filtered on the server, with no cap', async () => {
    const { service, commands } = codeReviews({ 'find review': recordsOutput(FOUND_REVIEWS, ON_CHANGESET) });

    await service.list(IN_WORKSPACE, { reviewerIsMe: true, status: 'Reviewed', owners: ['ana'], sinceDate: '2026-09-01', text: 'fix' });

    expect(commands).toMatchObject([
      {
        via: 'query',
        args: findQueryArgs(
          FOUND_REVIEWS,
          `where reviewer = 'me' and status = 'Reviewed' and title like '%ix%' and date >= '${roundTripDate('2026-09-01')}' and owner = 'ana' order by date desc`,
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
    expect(lines()).toEqual([foundLine(FOUND_REVIEWS, 'order by date desc')]);
  });

  it('caps a list only when asked, as the palette and the branch chips read the newest reviews', async () => {
    const { service, lines } = codeReviews({ 'find review': '' });

    await service.listSummaries(IN_WORKSPACE, { limit: 50 });

    expect(lines()).toEqual([foundLine(FOUND_REVIEWS, 'order by date desc limit 50')]);
  });

  it('finds one review by its number with one cm find, for the palette', async () => {
    const { service, lines } = codeReviews({ 'find review': recordsOutput(FOUND_REVIEWS, ON_CHANGESET) });

    const found = await service.listSummaries(IN_WORKSPACE, { id: 6 });

    expect(found.map((summary) => summary.id)).toEqual([6]);
    expect(lines()).toEqual([foundLine(FOUND_REVIEWS, 'where id = 6 order by date desc')]);
  });

  it("finds the reviews of one branch by its spec with one cm find, for the change requests a check-in can apply", async () => {
    const { service, lines } = codeReviews({ 'find review': recordsOutput(FOUND_REVIEWS, ON_TASK1) });

    const found = await service.listSummaries(IN_WORKSPACE, { targetBranch: '/main/task 1' });

    expect(found.map((summary) => summary.id)).toEqual([5]);
    expect(lines()).toEqual([foundLine(FOUND_REVIEWS, "where target = 'br:/main/task 1' order by date desc")]);
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

  // `cm codereview reviewer list` types each reviewer, which `{reviewers}` doesn't: a group shows as one even on a
  // server whose `cm listusers --onlygroups` lists none (one that takes the system's own group names).
  it("reads a review's reviewers with their types, read as they arrive, in one command", async () => {
    const { service, commands } = codeReviews({
      // As `cm` prints it with the app's separators: a record per reviewer, each after a line break.
      'codereview reviewer list': formatOutput(['ana@acme.com', 'Reviewed', 'user'], ['staff', 'Under review', 'group'], ['Web Devs', 'Rework required', 'group']),
    });

    expect(await service.reviewers(IN_WORKSPACE, 6)).toEqual([
      { name: 'ana@acme.com', status: 'Reviewed', kind: 'user' },
      { name: 'staff', status: 'Under review', kind: 'group' },
      { name: 'Web Devs', status: 'Rework required', kind: 'group' },
    ]);
    expect(commands).toMatchObject([{ via: 'query', readsRecords: true, args: ['codereview', 'reviewer', 'list', '6', `--format={user}${FIELD_SEPARATOR}{status}${FIELD_SEPARATOR}{type}${RECORD_SEPARATOR}`] }]);
  });

  it('reads a type it does not know as a user, and a group whatever its case or spaces', async () => {
    const { service } = codeReviews({ 'codereview reviewer list': formatOutput(['staff', 'Reviewed', ' Group '], ['bot', 'Reviewed', 'robot']) });

    expect((await service.reviewers(IN_WORKSPACE, 6)).map(({ kind }) => kind)).toEqual(['group', 'user']);
  });

  it('reads no reviewers of a review nobody was asked to, and names the repository outside a workspace', async () => {
    const { service, lines } = codeReviews({ 'codereview reviewer list': '' });

    expect(await service.reviewers(repositoryPlace('game@local'), 6)).toEqual([]);
    expect(lines()[0]).toMatch(/^codereview reviewer list 6 --format=\S+ --repository=game@local$/);
  });

  it("fails for a review that doesn't exist", async () => {
    const { service } = codeReviews({ 'find review': '' });

    await expect(service.get(IN_WORKSPACE, 6)).rejects.toThrow('Code review 6 was not found.');
  });
});

describe('code review writes', () => {
  it('creates a review asking its reviewers in the same command, and returns its id', async () => {
    const { service, commands } = codeReviews({ codereview: '42\n' });

    expect(await service.create(IN_WORKSPACE, { targetSpec: 'br:/main/task1', title: 'Jump', reviewers: [user('bob'), user(' eva '), user('')] })).toBe(42);
    expect(commands).toMatchObject([{ via: 'query', args: ['codereview', 'br:/main/task1', 'Jump', '--users=bob,eva', '--format={id}'] }]);
  });

  it('creates a review asking a group too, each kind in its own option', async () => {
    const { service, commands } = codeReviews({ codereview: '42\n' });

    await service.create(IN_WORKSPACE, { targetSpec: 'cs:12', title: 'Jump', reviewers: [user('bob'), group('Developers')] });

    expect(commands).toMatchObject([{ args: ['codereview', 'cs:12', 'Jump', '--users=bob', '--groups=Developers', '--format={id}'] }]);
  });

  it('creates a review asking nobody', async () => {
    const { service, lines } = codeReviews({ codereview: '42\n' });

    await service.create(IN_WORKSPACE, { targetSpec: 'cs:12', title: 'Jump', reviewers: [] });

    expect(lines()).toEqual(['codereview cs:12 Jump --format={id}']);
  });

  it('asks several reviewers with one command', async () => {
    const { service, commands } = codeReviews({ 'codereview reviewer add': '' });

    await service.addReviewers(IN_WORKSPACE, 6, [user('bob'), user('eva')]);

    expect(commands).toMatchObject([{ via: 'query', args: ['codereview', 'reviewer', 'add', '6', '--users=bob,eva'] }]);
  });

  it('removes several reviewers with one command', async () => {
    const { service, commands } = codeReviews({ 'codereview reviewer remove': '' });

    await service.removeReviewers(IN_WORKSPACE, 6, [user('bob'), user('eva')]);

    expect(commands).toMatchObject([{ via: 'query', args: ['codereview', 'reviewer', 'remove', '6', '--users=bob,eva'] }]);
  });

  it('asks reviewers to review again with one command', async () => {
    const { service, commands } = codeReviews({ 'codereview review': '' });

    await service.reRequestReview(IN_WORKSPACE, 6, [user('bob'), user('eva')]);

    expect(commands).toMatchObject([{ via: 'query', args: ['codereview', 'review', '6', '--re-request', '--users=bob,eva'] }]);
  });

  // `cm` looks a `--users` name up among the users only ("No such user"), so a group goes in `--groups`.
  it('adds, removes and asks again groups and users in one command each, every kind in its own option', async () => {
    const { service, commands } = codeReviews({ 'codereview reviewer add': '', 'codereview reviewer remove': '', 'codereview review': '' });
    const reviewers = [group('Web Devs'), user('bob'), group('Artists')];

    await service.addReviewers(IN_WORKSPACE, 6, reviewers);
    await service.removeReviewers(IN_WORKSPACE, 6, [group('Developers')]);
    await service.reRequestReview(IN_WORKSPACE, 6, [group('Developers')]);

    expect(commands.map(({ args }) => args)).toEqual([
      ['codereview', 'reviewer', 'add', '6', '--users=bob', '--groups=Web Devs,Artists'],
      ['codereview', 'reviewer', 'remove', '6', '--groups=Developers'],
      ['codereview', 'review', '6', '--re-request', '--groups=Developers'],
    ]);
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

  it('renames a review', async () => {
    const { service, commands } = codeReviews({ 'codereview -e': '' });

    await service.rename(IN_WORKSPACE, 6, 'Switching keeps changes');

    expect(commands).toMatchObject([{ via: 'query', args: ['codereview', '-e', '6', '--title=Switching keeps changes'] }]);
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
      "order by date desc on repository 'game@local'",
      "on repository 'game@local'",
      "where hidden = 'true' on repository 'game@local'",
    ]);
    expect(commands.every(({ options }) => options.outsideWorkspaces)).toBe(true);
  });

  // Outside a workspace, `cm codereview` with no `--repository` fails ("Object reference not set…") after creating.
  it('creates, asks reviewers, sets a status and deletes with --repository, the target spec naming the repository too', async () => {
    const { service, lines } = codeReviews({ codereview: '42\n' });

    expect(await service.create(ON_REPOSITORY, { targetSpec: 'cs:12', title: 'Jump' })).toBe(42);
    await service.addReviewers(ON_REPOSITORY, 6, [user('bob')]);
    await service.removeReviewers(ON_REPOSITORY, 6, [user('eva')]);
    await service.reRequestReview(ON_REPOSITORY, 6, [user('bob')]);
    await service.setOwnStatus(ON_REPOSITORY, 6, 'Reviewed');
    await service.remove(ON_REPOSITORY, [6, 7]);

    expect(lines()).toEqual([
      'codereview cs:12@game@local Jump --format={id} --repository=game@local',
      'codereview reviewer add 6 --users=bob --repository=game@local',
      'codereview reviewer remove 6 --users=eva --repository=game@local',
      'codereview review 6 --re-request --users=bob --repository=game@local',
      'codereview review 6 --reviewed --repository=game@local',
      'codereview -d 6 7 --repository=game@local',
    ]);
  });
});
