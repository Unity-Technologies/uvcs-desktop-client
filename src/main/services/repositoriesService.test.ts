import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseRepositoryGuid } from '@shared/domain/stableIds';
import { listRepositories } from '../cm/listRepositories';
import { RepositoryGuids } from '../cm/RepositoryGuids';
import { SettingsStore } from '../settings/SettingsStore';
import { ACCOUNT_FORMAT } from '../cm/accounts';
import { formatOutput } from '../cm/testing/cmOutput';
import { cmFails, fakeCmClient, type CmAnswer } from '../cm/testing/fakeCmClient';
import { createRepositoriesService } from './repositoriesService';
import { profilesContext, serviceContext } from './testing/serviceContext';

function repositories(answers: Record<string, CmAnswer>) {
  const fake = fakeCmClient(answers);
  return { ...fake, service: createRepositoriesService(serviceContext(fake.cm), profilesContext(fake.cm)) };
}

const LISTED = formatOutput(['4', 'tools', 'acme@cloud', 'bob'], ['2', 'game', 'acme@cloud', 'ana']);

describe('servers', () => {
  it("lists the profiles' servers with the local one first, from one local read", async () => {
    const { service, commands } = repositories({
      'profile list': formatOutput(['acme@cloud_ana', 'acme@cloud', 'ana', 'SSOWorkingMode'], ['*@cloud', '*@cloud', '', ''], ['local', 'local', '', 'NameWorkingMode']),
    });

    expect(await service.servers()).toEqual([
      { server: 'local', user: '', workingMode: '' },
      { server: 'acme@cloud', user: 'ana', workingMode: 'SSOWorkingMode' },
    ]);
    expect(commands).toMatchObject([{ via: 'query', args: ['profile', 'list', `--format=${ACCOUNT_FORMAT}`], options: { anyDirectory: true } }]);
  });
});

describe('repositories', () => {
  it('lists the repositories of a server by name, in a process that gives up on a server that never answers', async () => {
    const { service, commands } = repositories({ 'repository list': LISTED });

    const listed = await service.list('acme@cloud');

    expect(listed).toEqual({
      repositories: [
        { id: '2', name: 'game', server: 'acme@cloud', owner: 'ana', spec: 'game@acme@cloud' },
        { id: '4', name: 'tools', server: 'acme@cloud', owner: 'bob', spec: 'tools@acme@cloud' },
      ],
      projects: [],  deletedRepositories: [],
    });
    expect(commands).toMatchObject([{ via: 'execute', args: ['repository', 'list', 'acme@cloud', '--format={repid}\u001f{repname}\u001f{repserver}\u001f{repowner}\u001f{reptype}\u001f{repguid}\u001e'] }]);
    expect(commands[0]?.options.signal).toBeInstanceOf(AbortSignal);
  });

  it("lists a Unity organization's projects with its repositories, in the one command", async () => {
    const { service, lines } = repositories({
      'repository list racing@unity --type=all': formatOutput(
        ['3', 'Racing', 'racing@unity', 'ana', 'Project', '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f'],
        ['4', 'Racing/Game', 'racing@unity', 'bob', 'VCS', '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'],
      ),
    });

    expect(await service.list('racing@unity')).toEqual({
      repositories: [{ id: '4', guid: '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', name: 'Racing/Game', server: 'racing@unity', owner: 'bob', spec: 'Racing/Game@racing@unity', project: 'Racing' }],
      projects: [{ name: 'Racing', guid: '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f' }],
      deletedRepositories: [],
    });
    expect(lines()).toHaveLength(1);
  });

  it('lists only the repositories of a Unity organization when cm refuses --type', async () => {
    const { service, lines } = repositories({
      // As cm refuses an option it doesn't take: the complaint, the command's description, then its usage help.
      'repository list racing@unity --type=all': cmFails(
        [
          'repository: Unexpected option --type',
          'Lists the repositories on a server.',
          'Usage:',
          '',
          '    cm repository | repo list | ls [<repserverspec>] [--format=<str_format>]',
          '',
        ].join('\n'),
      ),
      'repository list racing@unity': formatOutput(['4', 'Racing/Game', 'racing@unity', 'bob']),
    });

    expect(await service.list('racing@unity')).toEqual({
      repositories: [{ id: '4', name: 'Racing/Game', server: 'racing@unity', owner: 'bob', spec: 'Racing/Game@racing@unity' }],
      projects: [],
      deletedRepositories: [],
    });
    expect(lines()).toHaveLength(2);
  });

  it("lists only the repositories of a Unity organization when cm doesn't know --type's all", async () => {
    const { service, lines } = repositories({
      'repository list racing@unity --type=all': cmFails("Requested value 'all' was not found."),
      'repository list racing@unity': formatOutput(['4', 'Racing/Game', 'racing@unity', 'bob']),
    });

    expect((await service.list('racing@unity')).projects).toEqual([]);
    expect(lines()).toHaveLength(2);
  });

  it('fails a Unity organization that cm can\'t reach at once, never asking twice', async () => {
    const { service, lines } = repositories({ 'repository list': cmFails('Unable to connect to racing@unity') });

    await expect(service.list('racing@unity')).rejects.toThrow('Unable to connect');
    expect(lines()).toHaveLength(1);
  });

  it('creates a repository with one command in its documented form for a server, listing none, and returns its spec', async () => {
    const { service, lines } = repositories({ repository: '' });

    expect(await service.create('acme@cloud', 'tools')).toBe('tools@acme@cloud');
    expect(lines()).toEqual(['repository acme@cloud tools']);
  });

  it('fails as cm reports it when the creation fails', async () => {
    const { service } = repositories({ repository: cmFails('Error: The repository tools already exists.') });

    await expect(service.create('acme@cloud', 'tools')).rejects.toThrow('already exists');
  });

  it('renames and deletes a repository by its spec', async () => {
    const { service, lines } = repositories({ repository: '' });

    await service.rename('tools@acme@cloud', 'build-tools');
    await service.remove('tools@acme@cloud');

    expect(lines()).toEqual(['repository rename tools@acme@cloud build-tools', 'repository delete tools@acme@cloud']);
  });

  describe('restore', () => {
    const DELETED = 'd1e2f3a4-b5c6-4d7e-8f90-a1b2c3d4e5f6@acme@cloud';

    it('restores a deleted repository by its GUID under the name it had, in one quick command', async () => {
      const { service, commands } = repositories({ 'repository undelete': '' });

      await service.restore(DELETED);
      expect(commands).toMatchObject([{ via: 'query', args: ['repository', 'undelete', DELETED] }]);
    });

    it('restores one under a new name when another repository took its own', async () => {
      const { service, lines } = repositories({ 'repository undelete': '' });

      await service.restore(DELETED, 'art-restored');
      expect(lines()).toEqual([`repository undelete ${DELETED} art-restored`]);
    });

    it('fails as cm reports it', async () => {
      const { service } = repositories({ 'repository undelete': cmFails('You are not allowed to undelete repositories.') });

      await expect(service.restore(DELETED)).rejects.toThrow('not allowed');
    });
  });

  it('tells a rename by the repository’s spec before and after, so its issue tracker follows it', async () => {
    const fake = fakeCmClient({ 'repository rename': '' });
    const renames: string[][] = [];
    const service = createRepositoriesService(serviceContext(fake.cm), profilesContext(fake.cm), (from, to) => renames.push([from, to]));
    await service.rename('tools@acme@cloud', 'build-tools');
    expect(renames).toEqual([['tools@acme@cloud', 'build-tools@acme@cloud']]);
  });

  it('keeps a repository renamed here known by its new name, with the GUID it had, without listing its server again', async () => {
    const { cm, lines } = fakeCmClient({
      'repository list': formatOutput(['4', 'tools', 'acme@cloud', 'bob', 'VCS', '5b0c3a52-1d7e-4f0b-9c4f-3e2a8b9d7c61']),
      'repository rename': '',
    });
    const context = serviceContext(cm);
    const renaming = createRepositoriesService(context, profilesContext(cm));
    await renaming.list('acme@cloud');

    await renaming.rename('tools@acme@cloud', 'build-tools');

    expect(await context.repositoryGuids.guidOf('acme@cloud', 'build-tools')).toBe('5b0c3a52-1d7e-4f0b-9c4f-3e2a8b9d7c61');
    expect(lines()).toEqual([expect.stringMatching(/^repository list acme@cloud/), 'repository rename tools@acme@cloud build-tools']);
  });
});

describe('guidOf', () => {
  const GAME = parseRepositoryGuid('0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d')!;
  const listed = (name: string) => formatOutput(['2', name, 'acme@cloud', 'ana', 'VCS', GAME]);

  /** The server's listing is each one in turn, then the last again; the clock moves only when the test says. */
  function lookups(...listings: string[]) {
    let calls = 0;
    const fake = fakeCmClient({ 'repository list': () => listings[Math.min(calls++, listings.length - 1)]!, 'repository acme@cloud': '' });
    const settings = new SettingsStore(join(mkdtempSync(join(tmpdir(), 'uvcs-guids-')), 'settings.json'));
    const clock = { now: 0 };
    const repositoryGuids = new RepositoryGuids((server) => listRepositories(fake.cm, server), () => clock.now);
    const context = serviceContext(fake.cm, { settings, repositoryGuids });
    return { ...fake, settings, clock, service: createRepositoriesService(context, profilesContext(fake.cm)) };
  }

  it('costs no command for a repository whose server the home screen listed', async () => {
    const { service, lines } = lookups(listed('game'));
    await service.list('acme@cloud');

    expect(await service.guidOf('game@acme@cloud')).toBe(GAME);
    expect(lines()).toHaveLength(1);
  });

  it('lists the server once for a repository no listing taught, and for nothing else', async () => {
    const { service, commands } = lookups(listed('game'));

    expect(await service.guidOf('Game@ACME@cloud')).toBe(GAME);
    expect(await service.guidOf('game@acme@cloud')).toBe(GAME);
    expect(commands).toMatchObject([{ via: 'execute', args: ['repository', 'list', 'ACME@cloud', expect.any(String)] }]);
  });

  it('answers null for a spec that names no server, without asking cm', async () => {
    const { service, lines } = lookups(listed('game'));

    expect(await service.guidOf('game')).toBeNull();
    expect(lines()).toEqual([]);
  });

  it('moves what was kept by the repository’s spec under its GUID, the first time it is known', async () => {
    const { service, settings } = lookups(listed('game'));
    settings.addWindowSettings({ repositorySettings: { 'game@acme@cloud': { explorerRulesOff: true } }, serverSettings: {}, changesetColors: { users: [] } });
    settings.update({ recentCommentsByRepository: { 'game@acme@cloud': ['Fix cs:4207'] } });

    await service.guidOf('game@acme@cloud');

    expect(settings.get().repositorySettings).toEqual({ [GAME]: { explorerRulesOff: true } });
    expect(settings.get().recentCommentsByRepository).toEqual({ [GAME]: ['Fix cs:4207'] });
  });

  it('finds a repository renamed elsewhere by its new name, with the GUID what was kept for it is kept by', async () => {
    const { service, settings, clock } = lookups(listed('game'), listed('racer'));
    await service.guidOf('game@acme@cloud');
    settings.updateRepositorySettings(GAME, { branchPins: [{ branch: 4, row: 1 }] });
    clock.now += 61_000;

    const lookedUp = await service.guidOf('racer@acme@cloud');

    expect(lookedUp).toBe(GAME);
    expect(settings.get().repositorySettings[lookedUp!]).toEqual({ branchPins: [{ branch: 4, row: 1 }] });
  });

  it('finds a repository created here, however recent the last listing', async () => {
    const { service, lines } = lookups(formatOutput(), listed('game'));
    await service.list('acme@cloud');

    await service.create('acme@cloud', 'game');

    expect(await service.guidOf('game@acme@cloud')).toBe(GAME);
    expect(lines().filter((line) => line.startsWith('repository list'))).toHaveLength(2);
  });

  it('rejects when the server can’t be listed', async () => {
    const fake = fakeCmClient({ 'repository list': cmFails('Unable to connect to acme@cloud') });
    const service = createRepositoriesService(serviceContext(fake.cm), profilesContext(fake.cm));

    await expect(service.guidOf('game@acme@cloud')).rejects.toThrow('Unable to connect');
  });
});
