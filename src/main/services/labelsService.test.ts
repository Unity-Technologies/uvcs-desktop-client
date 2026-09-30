import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fakeCmClient, findXml, optionValue, type CmAnswer, type FakeCmCommand } from '../cm/testing/fakeCmClient';
import { createLabelsService } from './labelsService';
import { serviceContext } from './testing/serviceContext';

const WORKSPACE = join(tmpdir(), 'wkspaces', 'game');

function labels(answers: Record<string, CmAnswer>) {
  const fake = fakeCmClient(answers);
  return { ...fake, service: createLabelsService(serviceContext(fake.cm)) };
}

/** Answers every command, keeping what its comment file held while it ran. */
function readingComment() {
  const seen = { commentsFile: '', comment: '' };
  const answer = ({ args }: FakeCmCommand): string => {
    seen.commentsFile = optionValue(args, '-commentsfile=')!;
    seen.comment = readFileSync(seen.commentsFile, 'utf8');
    return '';
  };
  return { seen, answer };
}

const V1 = { ID: 80, NAME: 'v1.0', CHANGESET: 12, BRANCH: '/main', COMMENT: 'First', OWNER: 'ana', DATE: '2026-09-25T10:00:00+02:00', REPNAME: 'game', REPSERVER: 'local' };

describe('labels', () => {
  it('lists labels newest first with one cm find, filtered on the server', async () => {
    const { service, commands } = labels({ 'find label': findXml('MARKER', V1) });

    const listed = await service.list(WORKSPACE, { text: 'v1', limit: 20 });

    expect(commands).toMatchObject([{ via: 'query', args: ['find', 'label', "where name like '%1%' order by date desc limit 20", '--xml', '--nototal'] }]);
    expect(listed).toEqual([{ id: 80, name: 'v1.0', changeset: 12, branch: '/main', comment: 'First', owner: 'ana', date: '2026-09-25T10:00:00+02:00', repository: 'game@local' }]);
  });

  it("labels the workspace's loaded changeset, or the one given, with the comment in a file deleted afterwards", async () => {
    const { seen, answer } = readingComment();
    const { service, commands } = labels({ 'label create': answer });

    await service.create(WORKSPACE, { name: 'v1.1', comment: 'Release\nnotes' });
    await service.create(WORKSPACE, { name: 'v1.2', changesetId: 14, comment: 'Next' });

    expect(commands.map(({ via, args }) => [via, args.slice(0, 4)])).toEqual([
      ['query', ['label', 'create', 'lb:v1.1', WORKSPACE]],
      ['query', ['label', 'create', 'lb:v1.2', 'cs:14']],
    ]);
    expect(seen.comment).toBe('Next');
    expect(existsSync(seen.commentsFile)).toBe(false);
  });

  it('replaces a comment outside any workspace, by specs that name the repository', async () => {
    const { seen, answer } = readingComment();
    const { service, commands } = labels({ 'label create': answer });

    await service.editComment(WORKSPACE, { name: 'v1.0', changeset: 12, repository: 'game@local' }, 'New\ncomment');

    expect(commands).toMatchObject([{ via: 'query', args: ['label', 'create', 'lb:v1.0@game@local', 'cs:12@game@local', `-commentsfile=${seen.commentsFile}`] }]);
    expect(commands[0]?.options.cwd).toBeUndefined();
    expect(seen.comment).toBe('New\ncomment');
  });

  it('refuses to empty a comment without asking cm', async () => {
    const { service, commands } = labels({});

    await expect(service.editComment(WORKSPACE, { name: 'v1.0', changeset: 12, repository: 'game@local' }, '  ')).rejects.toThrow();
    expect(commands).toEqual([]);
  });

  it('renames a label, and deletes several with one command', async () => {
    const { service, lines } = labels({ label: '' });

    await service.rename(WORKSPACE, 'v1.0', 'v1.0-final');
    await service.delete(WORKSPACE, ['v1.0', 'v1.1']);

    expect(lines()).toEqual(['label rename lb:v1.0 v1.0-final', 'label delete lb:v1.0 lb:v1.1']);
  });
});
