import { describe, expect, it } from 'vitest';
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
      projects: [],
    });
    expect(commands).toMatchObject([{ via: 'execute', args: ['repository', 'list', 'acme@cloud', '--format={repid}\u001f{repname}\u001f{repserver}\u001f{repowner}\u001e'] }]);
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
      repositories: [{ id: '4', name: 'Racing/Game', server: 'racing@unity', owner: 'bob', spec: 'Racing/Game@racing@unity', project: 'Racing' }],
      projects: [{ name: 'Racing', guid: '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f' }],
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
});
