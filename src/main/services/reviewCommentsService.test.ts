import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { findQueryArgs } from '../cm/findQuery';
import { FOUND_REVIEW_COMMENTS } from '../cm/reviewCommentRecords';
import { recordsOutput } from '../cm/testing/cmOutput';
import { fakeCmClient, type CmAnswer } from '../cm/testing/fakeCmClient';
import { createReviewCommentsService } from './reviewCommentsService';
import { readingFileOption } from './testing/readingFileOption';
import { serviceContext } from './testing/serviceContext';

const WORKSPACE = join(tmpdir(), 'wkspaces', 'game');
const IN_WORKSPACE = workspacePlace(WORKSPACE);
const ON_REPOSITORY = repositoryPlace('game@local');

function reviewComments(answers: Record<string, CmAnswer>) {
  const fake = fakeCmClient(answers);
  return { ...fake, service: createReviewCommentsService(serviceContext(fake.cm)) };
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
