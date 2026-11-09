import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { FOUND_SHELVES } from '../cm/foundObjects';
import { foundLine, recordsOutput } from '../cm/testing/cmOutput';
import { cmFails, fakeCmClient } from '../cm/testing/fakeCmClient';
import type { SwitchContext } from './ServiceContext';
import { createShelvesService } from './shelvesService';
import { readingFileOption } from './testing/readingFileOption';
import { serviceContext } from './testing/serviceContext';

const WORKSPACE = join(tmpdir(), 'wkspaces', 'game');

function shelveRecord(id: number) {
  return { shelveid: id, comment: `Shelve ${id}`, date: '2026-09-25T10:00:00+02:00', owner: 'ana', repname: 'game', repserver: 'local', parent: 5, guid: `guid-${id}` };
}

describe('shelves', () => {
  it('lists shelves newest first with one cm find, which cannot sort them', async () => {
    const fake = fakeCmClient({ 'find shelve': recordsOutput(FOUND_SHELVES, shelveRecord(3), shelveRecord(9), shelveRecord(5)) });
    const service = createShelvesService(serviceContext(fake.cm), {} as SwitchContext);

    const listed = await service.list(workspacePlace(WORKSPACE), { owners: ['me'], branch: '/main' });

    expect(fake.lines()).toEqual([foundLine(FOUND_SHELVES, "where owner = 'me'")]);
    expect(listed.map((shelve) => shelve.id)).toEqual([9, 5, 3]);
  });

  it('lists the shelves of a repository with no workspace naming it, outside every workspace', async () => {
    const fake = fakeCmClient({ 'find shelve': recordsOutput(FOUND_SHELVES, shelveRecord(3)) });
    const service = createShelvesService(serviceContext(fake.cm), {} as SwitchContext);

    await service.list(repositoryPlace('game@local'), { owners: ['me'] });

    expect(fake.commands.map(({ args, options }) => [args[2], options])).toEqual([["where owner = 'me' on repository 'game@local'", { outsideWorkspaces: true }]]);
  });

  it("replaces a shelve's comment with one quick command on the changeset below zero it is, the comment in a file deleted afterwards", async () => {
    const { seen, answer } = readingFileOption('-commentsfile=');
    const fake = fakeCmClient({ 'changeset editcomment': answer });
    const service = createShelvesService(serviceContext(fake.cm), {} as SwitchContext);

    await service.editComment(workspacePlace(WORKSPACE), 12, 'Spike the "new" HUD\r\nWith the radar');

    expect(fake.commands).toMatchObject([{ via: 'query', args: ['changeset', 'editcomment', 'cs:-12', `-commentsfile=${seen.file}`], options: { cwd: WORKSPACE } }]);
    expect(seen.content).toBe('Spike the "new" HUD\r\nWith the radar');
    expect(existsSync(seen.file)).toBe(false);
  });

  it('clears a comment with an empty file, and names the repository outside every workspace', async () => {
    const { seen, answer } = readingFileOption('-commentsfile=');
    const fake = fakeCmClient({ 'changeset editcomment': answer });
    const service = createShelvesService(serviceContext(fake.cm), {} as SwitchContext);

    await service.editComment(repositoryPlace('game@local'), 12, '');

    expect(fake.commands).toMatchObject([{ args: ['changeset', 'editcomment', 'cs:-12@game@local', `-commentsfile=${seen.file}`], options: { outsideWorkspaces: true } }]);
    expect(seen.content).toBe('');
  });

  it("deletes the comment file when cm can't find the shelve", async () => {
    const { seen, answer } = readingFileOption('-commentsfile=', cmFails("Changeset -99 doesn't exist in repository game@local."));
    const fake = fakeCmClient({ 'changeset editcomment': answer });
    const service = createShelvesService(serviceContext(fake.cm), {} as SwitchContext);

    await expect(service.editComment(workspacePlace(WORKSPACE), 99, 'Gone')).rejects.toThrow("doesn't exist");
    expect(existsSync(seen.file)).toBe(false);
  });
});
