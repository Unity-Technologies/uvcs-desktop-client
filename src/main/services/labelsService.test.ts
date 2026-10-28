import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { findQueryArgs } from '../cm/findQuery';
import { FOUND_LABELS } from '../cm/foundObjects';
import { recordsOutput } from '../cm/testing/cmOutput';
import { fakeCmClient, type CmAnswer } from '../cm/testing/fakeCmClient';
import { createLabelsService } from './labelsService';
import { readingFileOption } from './testing/readingFileOption';
import { serviceContext } from './testing/serviceContext';

const WORKSPACE = join(tmpdir(), 'wkspaces', 'game');
const IN_WORKSPACE = workspacePlace(WORKSPACE);

function labels(answers: Record<string, CmAnswer>) {
  const fake = fakeCmClient(answers);
  return { ...fake, service: createLabelsService(serviceContext(fake.cm)) };
}

const V1 = { id: 80, name: 'v1.0', changeset: 12, branch: '/main', comment: 'First', owner: 'ana', date: '2026-09-25T10:00:00+02:00', repname: 'game', repserver: 'local' };

describe('labels', () => {
  it('lists labels newest first with one cm find, filtered on the server', async () => {
    const { service, commands } = labels({ 'find label': recordsOutput(FOUND_LABELS, V1) });

    const listed = await service.list(IN_WORKSPACE, { text: 'v1', limit: 20 });

    expect(commands).toMatchObject([{ via: 'query', args: findQueryArgs(FOUND_LABELS, "where name like '%1%' order by date desc limit 20") }]);
    expect(listed).toEqual([{ id: 80, name: 'v1.0', changeset: 12, branch: '/main', comment: 'First', owner: 'ana', date: '2026-09-25T10:00:00+02:00', repository: 'game@local' }]);
  });

  it('finds one label by its name with one cm find, none when there is no such label', async () => {
    const { service, commands } = labels({ "find label where name = 'v1.0'": recordsOutput(FOUND_LABELS, V1), "find label where name = 'v9'": '' });

    expect(await service.get(IN_WORKSPACE, 'v1.0')).toMatchObject({ name: 'v1.0', changeset: 12 });
    expect(await service.get(IN_WORKSPACE, 'v9')).toBeNull();
    expect(commands).toMatchObject([{ via: 'query', args: findQueryArgs(FOUND_LABELS, "where name = 'v1.0'") }, { via: 'query' }]);
  });

  it("labels the workspace's loaded changeset, or the one given, with the comment in a file deleted afterwards", async () => {
    const { seen, answer } = readingFileOption('-commentsfile=');
    const { service, commands } = labels({ 'label create': answer });

    await service.create(IN_WORKSPACE, { name: 'v1.1', comment: 'Release\nnotes' });
    await service.create(IN_WORKSPACE, { name: 'v1.2', changesetId: 14, comment: 'Next' });

    expect(commands.map(({ via, args }) => [via, args.slice(0, 4)])).toEqual([
      ['query', ['label', 'create', 'lb:v1.1', WORKSPACE]],
      ['query', ['label', 'create', 'lb:v1.2', 'cs:14']],
    ]);
    expect(seen.content).toBe('Next');
    expect(existsSync(seen.file)).toBe(false);
  });

  it('replaces a comment outside any workspace, by specs that name the repository', async () => {
    const { seen, answer } = readingFileOption('-commentsfile=');
    const { service, commands } = labels({ 'label create': answer });

    await service.editComment(IN_WORKSPACE, { name: 'v1.0', changeset: 12, repository: 'game@local' }, 'New\ncomment');

    expect(commands).toMatchObject([{ via: 'query', args: ['label', 'create', 'lb:v1.0@game@local', 'cs:12@game@local', `-commentsfile=${seen.file}`] }]);
    expect(commands[0]?.options).toEqual({ outsideWorkspaces: true });
    expect(seen.content).toBe('New\ncomment');
  });

  it('refuses to empty a comment without asking cm', async () => {
    const { service, commands } = labels({});

    await expect(service.editComment(IN_WORKSPACE, { name: 'v1.0', changeset: 12, repository: 'game@local' }, '  ')).rejects.toThrow();
    expect(commands).toEqual([]);
  });

  it('renames a label, and deletes several with one command', async () => {
    const { service, lines } = labels({ label: '' });

    await service.rename(IN_WORKSPACE, 'v1.0', 'v1.0-final');
    await service.delete(IN_WORKSPACE, ['v1.0', 'v1.1']);

    expect(lines()).toEqual(['label rename lb:v1.0 v1.0-final', 'label delete lb:v1.0 lb:v1.1']);
  });
});

describe('labels of a repository explored without a workspace', () => {
  const ON_REPOSITORY = repositoryPlace('game@local');

  it("reads another repository's label for a comment's chip with one quick find, the repository as the place", async () => {
    const { service, commands } = labels({ 'find label': recordsOutput(FOUND_LABELS, V1) });

    await service.get(repositoryPlace('art@acme@cloud'), 'v1.0');

    expect(commands.map(({ via, args }) => [via, args[2]])).toEqual([['query', "where name = 'v1.0' on repository 'art@acme@cloud'"]]);
  });

  it('lists, finds, creates, renames and deletes naming the repository, outside every workspace', async () => {
    const { seen, answer } = readingFileOption('-commentsfile=');
    const { service, commands } = labels({ 'find label': recordsOutput(FOUND_LABELS, V1), 'label create': answer, label: '' });

    await service.list(ON_REPOSITORY, { limit: 20 });
    await service.get(ON_REPOSITORY, 'v1.0');
    await service.create(ON_REPOSITORY, { name: 'v1.2', changesetId: 14, comment: 'Next' });
    await service.rename(ON_REPOSITORY, 'v1.0', 'v1.0-final');
    await service.delete(ON_REPOSITORY, ['v1.0', 'v1.1']);

    expect(commands.map(({ args }) => (args[0] === 'find' ? args[2] : args.slice(0, 4).join(' ')))).toEqual([
      "order by date desc limit 20 on repository 'game@local'",
      "where name = 'v1.0' on repository 'game@local'",
      'label create lb:v1.2@game@local cs:14@game@local',
      'label rename lb:v1.0@game@local v1.0-final',
      'label delete lb:v1.0@game@local lb:v1.1@game@local',
    ]);
    expect(commands.every(({ options }) => options.outsideWorkspaces)).toBe(true);
    expect(seen.content).toBe('Next');
  });

  it('refuses to label without naming a changeset, as there is no loaded one', async () => {
    const { service, commands } = labels({});

    await expect(service.create(ON_REPOSITORY, { name: 'v1.2', comment: '' })).rejects.toThrow('name the changeset');
    expect(commands).toEqual([]);
  });
});
