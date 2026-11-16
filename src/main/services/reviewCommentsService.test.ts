import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { BranchNamesCache } from '../cm/BranchNamesCache';
import { readBranchNames } from '../cm/branchNames';
import { findQueryArgs } from '../cm/findQuery';
import { FOUND_REVIEW_COMMENTS } from '../cm/reviewCommentRecords';
import { formatOutput, recordsOutput } from '../cm/testing/cmOutput';
import { fakeCmClient, type CmAnswer } from '../cm/testing/fakeCmClient';
import { createReviewCommentsService } from './reviewCommentsService';
import { readingFileOption } from './testing/readingFileOption';
import { serviceContext } from './testing/serviceContext';

const WORKSPACE = join(tmpdir(), 'wkspaces', 'game');
const IN_WORKSPACE = workspacePlace(WORKSPACE);
const ON_REPOSITORY = repositoryPlace('game@local');

/** Wired as `createServices` wires it: branch ids in the server's notes are named by the cache, which reads every branch only when it must. */
function reviewComments(answers: Record<string, CmAnswer>) {
  const fake = fakeCmClient(answers);
  const branchNames = new BranchNamesCache((place) => readBranchNames(fake.cm, place));
  return { ...fake, service: createReviewCommentsService(serviceContext(fake.cm), { branchNames }) };
}

/** A note of the server's, as `cm find changereviewcomment` prints it. */
function timelineNote(id: number, comment: string) {
  return { id, guid: `t${id}`, owner: 'ana', date: '2026-11-16T10:00:00+01:00', modifieddate: '2026-11-16T10:00:00+01:00', comment, type: 'timeline', parent: -1, revisionid: -1, line: '', changeset: -1, appliedinchangeset: -1 };
}

describe('reading a review conversation', () => {
  it("reads every comment of the review, oldest first, with one cm find read as it arrives", async () => {
    const { service, commands } = reviewComments({
      'find changereviewcomment': recordsOutput(
        FOUND_REVIEW_COMMENTS,
        { id: 43, guid: 'd1', owner: 'ana', date: '2026-11-06T10:00:00+01:00', modifieddate: '2026-11-06T10:00:00+01:00', comment: '[description]Why', type: 'timeline', parent: -1, revisionid: -1, line: '', changeset: -1, appliedinchangeset: -1 },
        { id: 44, guid: 'c1', owner: 'bob', date: '2026-11-06T10:05:00+01:00', modifieddate: '2026-11-06T10:05:00+01:00', comment: 'Nice', type: 'conversation', parent: -1, revisionid: -1, line: '', changeset: -1, appliedinchangeset: -1 },
      ),
    });

    const conversation = await service.conversation(IN_WORKSPACE, 41);

    expect(commands).toMatchObject([
      { via: 'query', readsRecords: true, args: findQueryArgs(FOUND_REVIEW_COMMENTS, 'where reviewid = 41 order by date asc'), options: { cwd: WORKSPACE } },
    ]);
    expect(conversation.description?.text).toBe('Why');
    expect(conversation.comments.map((comment) => comment.guid)).toEqual(['c1']);
  });

  it('names the repository outside every workspace', async () => {
    const { service, commands } = reviewComments({ 'find changereviewcomment': '' });

    await service.conversation(ON_REPOSITORY, 41);

    expect(commands[0]?.args[2]).toBe("where reviewid = 41 order by date asc on repository 'game@local'");
    expect(commands[0]?.options.outsideWorkspaces).toBe(true);
  });
});

describe("naming the branches a merge request's notes name", () => {
  const EVERY_BRANCH_NAME: Record<string, CmAnswer> = {
    'find branch': ({ line }) => (line.includes("hidden = 'true'") ? formatOutput(['26', '/main/task1']) : formatOutput(['4', '/main/release'], ['19', '/main'])),
  };

  it('reads no branch when no note names one', async () => {
    const { service, lines } = reviewComments({
      'find changereviewcomment': recordsOutput(FOUND_REVIEW_COMMENTS, timelineNote(1, '[mergerequest-status-draft-to-open]'), timelineNote(2, '[mergerequest-status-open-to-merged]6')),
    });

    await service.conversation(IN_WORKSPACE, 41);

    expect(lines()).toHaveLength(1);
  });

  it('names every branch the notes name with one lookup, hidden branches too', async () => {
    const { service, lines } = reviewComments({
      'find changereviewcomment': recordsOutput(
        FOUND_REVIEW_COMMENTS,
        timelineNote(1, '[changed-mergerequest-destination]4;19'),
        timelineNote(2, '[hidden-mergerequest-branch]26'),
        timelineNote(3, '[unhidden-mergerequest-branch]26'),
      ),
      ...EVERY_BRANCH_NAME,
    });

    const { events } = await service.conversation(IN_WORKSPACE, 41);

    expect(events.map(({ id, author, date, ...change }) => change)).toEqual([
      { kind: 'destinationChanged', from: { id: 4, name: '/main/release' }, to: { id: 19, name: '/main' } },
      { kind: 'branchHidden', branch: { id: 26, name: '/main/task1' } },
      { kind: 'branchUnhidden', branch: { id: 26, name: '/main/task1' } },
    ]);
    // The cache's one read of every branch: the visible ones, then the hidden.
    expect(lines().filter((line) => line.startsWith('find branch'))).toHaveLength(2);
  });

  it("still reads the conversation when the branches' names can't be read, its branches by id alone", async () => {
    const { service } = reviewComments({
      'find changereviewcomment': recordsOutput(FOUND_REVIEW_COMMENTS, timelineNote(1, '[changed-mergerequest-destination]4;19')),
      'find branch': () => {
        throw new Error('Connection refused');
      },
    });

    const { events } = await service.conversation(IN_WORKSPACE, 41);

    expect(events.map(({ id, author, date, ...change }) => change)).toEqual([{ kind: 'destinationChanged', from: { id: 4 }, to: { id: 19 } }]);
  });

  it('keeps a branch deleted since by its id alone', async () => {
    const { service } = reviewComments({
      'find changereviewcomment': recordsOutput(FOUND_REVIEW_COMMENTS, timelineNote(1, '[changed-mergerequest-destination]77;19')),
      ...EVERY_BRANCH_NAME,
    });

    const { events } = await service.conversation(IN_WORKSPACE, 41);

    expect(events[0]).toEqual(expect.objectContaining({ kind: 'destinationChanged', from: { id: 77 }, to: { id: 19, name: '/main' } }));
  });
});

describe('writing on a review', () => {
  it('adds a comment on the whole review, its text in a file deleted afterwards', async () => {
    const { seen, answer } = readingFileOption('-commentsfile=');
    const { service, commands } = reviewComments({ 'codereview comment add': answer });

    await service.add(IN_WORKSPACE, 41, 'Nice work.\n\nCould we add a test?');

    expect(commands).toMatchObject([{ via: 'query', args: ['codereview', 'comment', 'add', '41', `-commentsfile=${seen.file}`] }]);
    expect(seen.content).toBe('Nice work.\n\nCould we add a test?');
    expect(existsSync(seen.file)).toBe(false);
  });

  it('adds a change request on a line of the revision the diff shows, by its revision id', async () => {
    const { seen, answer } = readingFileOption('-commentsfile=');
    const { service, commands } = reviewComments({ 'codereview comment add': answer });

    await service.addOnLine(IN_WORKSPACE, 41, { revisionId: 812, line: 42, kind: 'changeRequest' }, 'Rename this.');

    expect(commands).toMatchObject([
      { via: 'query', args: ['codereview', 'comment', 'add', '41', `-commentsfile=${seen.file}`, '--revision=revid:812', '--line=42', '--type=Change'] },
    ]);
    expect(seen.content).toBe('Rename this.');
    expect(existsSync(seen.file)).toBe(false);
  });

  it("writes a question or a comment as cm types them, in the diff of the changeset it's written in", async () => {
    const { service, commands } = reviewComments({ 'codereview comment add': '' });

    await service.addOnLine(IN_WORKSPACE, 41, { revisionId: 812, line: 1, kind: 'question', changesetId: 9 }, 'Why?');
    await service.addOnLine(IN_WORKSPACE, 41, { revisionId: 812, line: 1, kind: 'comment' }, 'Nice.');

    expect(commands.map(({ args }) => args.slice(5))).toEqual([
      ['--revision=revid:812', '--line=1', '--type=Question', '--changeset=cs:9'],
      ['--revision=revid:812', '--line=1', '--type=Comment'],
    ]);
  });

  it('replies to a comment', async () => {
    const { seen, answer } = readingFileOption('-commentsfile=');
    const { service, commands } = reviewComments({ 'codereview comment reply': answer });

    await service.reply(IN_WORKSPACE, 'b65e', 'Yes, next changeset.');

    expect(commands).toMatchObject([{ via: 'query', args: ['codereview', 'comment', 'reply', 'b65e', `-commentsfile=${seen.file}`] }]);
    expect(seen.content).toBe('Yes, next changeset.');
  });

  it('discards a change request with a reply saying why', async () => {
    const { seen, answer } = readingFileOption('-commentsfile=');
    const { service, commands } = reviewComments({ 'codereview comment reply': answer });

    await service.reply(IN_WORKSPACE, 'c1', 'Target is the word cm uses.', { discard: true });

    expect(commands[0]?.args).toEqual(['codereview', 'comment', 'reply', 'c1', `-commentsfile=${seen.file}`, '--discard']);
  });

  it('edits a comment', async () => {
    const { seen, answer } = readingFileOption('-commentsfile=');
    const { service, commands } = reviewComments({ 'codereview comment edit': answer });

    await service.edit(IN_WORKSPACE, 'c1', 'Static class reads well.');

    expect(commands[0]?.args).toEqual(['codereview', 'comment', 'edit', 'c1', `-commentsfile=${seen.file}`]);
    expect(seen.content).toBe('Static class reads well.');
  });

  it('deletes a comment', async () => {
    const { service, lines } = reviewComments({ 'codereview comment delete': '' });

    await service.remove(IN_WORKSPACE, 'c1');

    expect(lines()).toEqual(['codereview comment delete c1']);
  });

  it('writes the description from a file, an empty one clearing it', async () => {
    const { seen, answer } = readingFileOption('--descriptionfile=');
    const { service, commands } = reviewComments({ 'codereview -e': answer });

    await service.setDescription(IN_WORKSPACE, 41, '');

    expect(commands).toMatchObject([{ via: 'query', args: ['codereview', '-e', '41', `--descriptionfile=${seen.file}`] }]);
    expect(seen.content).toBe('');
  });

  it('marks a change request applied in the changeset picked, with one quick command', async () => {
    const { service, commands } = reviewComments({ 'codereview comment apply': '' });

    await service.markApplied(IN_WORKSPACE, 'c1', 12);

    expect(commands).toMatchObject([{ via: 'query', args: ['codereview', 'comment', 'apply', 'c1', '--changeset=cs:12'], options: { cwd: WORKSPACE } }]);
  });

  it('marks a change request as not applied, with one quick command', async () => {
    const { service, commands } = reviewComments({ 'codereview comment unapply': '' });

    await service.markNotApplied(IN_WORKSPACE, 'c1');

    expect(commands).toMatchObject([{ via: 'query', args: ['codereview', 'comment', 'unapply', 'c1'] }]);
  });

  it("names the changeset in the review's repository outside a workspace", async () => {
    const { service, commands } = reviewComments({ 'codereview comment apply': '' });

    await service.markApplied(ON_REPOSITORY, 'c1', 12);

    expect(commands[0]?.args).toEqual(['codereview', 'comment', 'apply', 'c1', '--changeset=cs:12@game@local', '--repository=game@local']);
  });

  it('names the repository in every write outside a workspace', async () => {
    const { service, commands } = reviewComments({ codereview: '' });

    await service.add(ON_REPOSITORY, 41, 'a');
    await service.addOnLine(ON_REPOSITORY, 41, { revisionId: 5, line: 3, kind: 'comment' }, 'a');
    await service.reply(ON_REPOSITORY, 'c1', 'b');
    await service.edit(ON_REPOSITORY, 'c1', 'c');
    await service.remove(ON_REPOSITORY, 'c1');
    await service.setDescription(ON_REPOSITORY, 41, 'd');
    await service.markApplied(ON_REPOSITORY, 'c1', 12);
    await service.markNotApplied(ON_REPOSITORY, 'c1');

    expect(commands.map(({ args }) => args.at(-1))).toEqual(Array(8).fill('--repository=game@local'));
    expect(commands.every(({ options }) => options.outsideWorkspaces)).toBe(true);
  });
});
