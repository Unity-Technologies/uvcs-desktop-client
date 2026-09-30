import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BranchNamesCache } from '../cm/BranchNamesCache';
import { readBranchNames } from '../cm/branchNames';
import { findXml, formatOutput } from '../cm/testing/cmOutput';
import { fakeCmClient, type CmAnswer } from '../cm/testing/fakeCmClient';
import { createCodeReviewsService } from './codeReviewsService';
import { serviceContext } from './testing/serviceContext';

const WORKSPACE = join(tmpdir(), 'wkspaces', 'game');

function review(id: number, targetType: string, target: string, status = 'Under review') {
  return {
    ID: id,
    TITLE: `Review ${id}`,
    STATUS: status,
    OWNER: 'ana',
    ASSIGNEE: 'bob',
    DATE: '2026-09-25T10:00:00+02:00',
    TARGETTYPE: targetType,
    TARGET: target,
  };
}

const ON_TASK1 = review(5, 'Branch', 'id:37');
const ON_CHANGESET = review(6, 'Changeset', '120');
const ON_SHELVE = review(7, 'Shelve', '3');
const ON_DELETED_BRANCH = review(8, 'Branch', 'id:99');

/** Wired as `createServices` wires them: branch names come from the cache, which reads every branch only when it must. */
function codeReviews(answers: Record<string, CmAnswer>) {
  const fake = fakeCmClient(answers);
  const branchNames = new BranchNamesCache((workspacePath) => readBranchNames(fake.cm, workspacePath));
  return { ...fake, branchNames, service: createCodeReviewsService(serviceContext(fake.cm), { branchNames }) };
}

const EVERY_BRANCH_NAME: Record<string, CmAnswer> = {
  'find branch': ({ line }) => (line.includes("hidden = 'true'") ? formatOutput(['21', '/main/old']) : formatOutput(['37', '/main/task1'])),
};

describe('code review list', () => {
  it('lists the newest reviews with one cm find, filtered on the server', async () => {
    const { service, commands } = codeReviews({ 'find review': findXml('REVIEW', ON_CHANGESET) });

    await service.list(WORKSPACE, { assignedToMe: true, status: 'Reviewed', owners: ['ana'], sinceDate: '2026-09-01', text: 'fix' });

    expect(commands).toMatchObject([
      {
        via: 'query',
        args: [
          'find',
          'review',
          "where assignee = 'me' and status = 'Reviewed' and title like '%ix%' and date >= '2026-09-01' and owner = 'ana' order by date desc limit 300",
          '--xml',
          '--nototal',
        ],
        options: { cwd: WORKSPACE },
      },
    ]);
  });

  it('names each target: changesets and shelves by number, branches by the names of every branch, read once', async () => {
    const { service, lines } = codeReviews({
      'find review': findXml('REVIEW', ON_TASK1, ON_CHANGESET, ON_SHELVE, ON_DELETED_BRANCH),
      ...EVERY_BRANCH_NAME,
    });

    const reviews = await service.list(WORKSPACE, {});

    expect(reviews.map((listed) => listed.target)).toEqual([
      { kind: 'branch', branch: '/main/task1' },
      { kind: 'changeset', changesetId: 120 },
      { kind: 'shelve', shelveId: 3 },
      { kind: 'unknown', description: 'an unknown branch' },
    ]);
    expect(lines().filter((line) => line.startsWith('find branch'))).toHaveLength(2);

    await service.list(WORKSPACE, {});
    expect(lines().filter((line) => line.startsWith('find branch'))).toHaveLength(2);
  });

  it('asks nothing more when the branch lists already read name every target', async () => {
    const { service, branchNames, lines } = codeReviews({ 'find review': findXml('REVIEW', ON_TASK1) });
    branchNames.remember(WORKSPACE, [{ id: 37, name: '/main/task1' }]);

    const [listed] = await service.list(WORKSPACE, {});

    expect(listed?.target).toEqual({ kind: 'branch', branch: '/main/task1' });
    expect(lines()).toEqual(["find review order by date desc limit 300 --xml --nototal"]);
  });

  it('lists summaries with branch targets by id, never reading branch names', async () => {
    const { service, lines } = codeReviews({ 'find review': findXml('REVIEW', ON_TASK1, ON_CHANGESET) });

    const summaries = await service.listSummaries(WORKSPACE, {});

    expect(summaries.map((summary) => summary.targetBranchId)).toEqual([37, undefined]);
    expect(lines()).toHaveLength(1);
  });
});

describe('one code review', () => {
  it('reads a review by id', async () => {
    const { service, lines } = codeReviews({ 'find review': findXml('REVIEW', ON_CHANGESET) });

    expect(await service.get(WORKSPACE, 6)).toMatchObject({ id: 6, title: 'Review 6', status: 'Under review', target: { kind: 'changeset' } });
    expect(lines()).toEqual(['find review where id = 6 order by date desc --xml --nototal']);
  });

  it("fails for a review that doesn't exist", async () => {
    const { service } = codeReviews({ 'find review': findXml('REVIEW') });

    await expect(service.get(WORKSPACE, 6)).rejects.toThrow('Code review 6 was not found.');
  });
});

describe('code review writes', () => {
  it('creates a review and returns its id', async () => {
    const { service, commands } = codeReviews({ codereview: '42\n' });

    expect(await service.create(WORKSPACE, { targetSpec: 'br:/main/task1', title: 'Jump', assignee: 'bob' })).toBe(42);
    expect(commands).toMatchObject([{ via: 'query', args: ['codereview', 'br:/main/task1', 'Jump', '--assignee=bob', '--format={id}'] }]);
  });

  it('changes the assignee with one command, reading nothing back', async () => {
    const { service, lines } = codeReviews({ 'codereview -e': '' });

    await service.update(WORKSPACE, 6, { assignee: '' });

    expect(lines()).toEqual(['codereview -e 6 --assignee=']);
  });

  it('checks that a status change took, as cm ignores it on reviews nobody is assigned to', async () => {
    const { service, lines } = codeReviews({ 'codereview -e': '', 'find review': findXml('REVIEW', review(6, 'Changeset', '120', 'Reviewed')) });

    await service.update(WORKSPACE, 6, { status: 'Reviewed' });

    expect(lines()).toEqual(['codereview -e 6 --status=Reviewed', 'find review where id = 6 order by date desc --xml --nototal']);
  });

  it('fails when cm left the status as it was', async () => {
    const { service } = codeReviews({ 'codereview -e': '', 'find review': findXml('REVIEW', review(6, 'Changeset', '120', 'Under review')) });

    await expect(service.update(WORKSPACE, 6, { status: 'Reviewed' })).rejects.toThrow('Assign the review, then try again.');
  });

  it('deletes several reviews with one command', async () => {
    const { service, lines } = codeReviews({ 'codereview -d': '' });

    await service.remove(WORKSPACE, [6, 7]);

    expect(lines()).toEqual(['codereview -d 6 7']);
  });
});
