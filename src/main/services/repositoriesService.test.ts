import { describe, expect, it } from 'vitest';
import { formatOutput } from '../cm/testing/cmOutput';
import { cmFails, fakeCmClient, type CmAnswer } from '../cm/testing/fakeCmClient';
import { createRepositoriesService } from './repositoriesService';
import { serviceContext } from './testing/serviceContext';

function repositories(answers: Record<string, CmAnswer>) {
  const fake = fakeCmClient(answers);
  return { ...fake, service: createRepositoriesService(serviceContext(fake.cm)) };
}

const LISTED = formatOutput(['4', 'tools', 'codice@cloud', 'bob'], ['2', 'game', 'codice@cloud', 'ana']);

describe('servers', () => {
  it("lists the profiles' servers with the local one first, from one local read", async () => {
    const { service, commands } = repositories({
      'profile list': formatOutput(['codice@cloud', 'ana', 'SSOWorkingMode'], ['*@cloud', '', ''], ['local', '', 'NameWorkingMode']),
    });

    expect(await service.servers()).toEqual([
      { server: 'local', user: '', workingMode: '' },
      { server: 'codice@cloud', user: 'ana', workingMode: 'SSOWorkingMode' },
    ]);
    expect(commands).toMatchObject([{ via: 'query', args: ['profile', 'list', '--format={server}\u001f{user}\u001f{workingmode}\u001e'] }]);
  });
});

describe('repositories', () => {
  it('lists the repositories of a server by name, in a process that gives up on a server that never answers', async () => {
    const { service, commands } = repositories({ 'repository list': LISTED });

    const listed = await service.list('codice@cloud');

    expect(listed).toEqual([
      { id: '2', name: 'game', server: 'codice@cloud', owner: 'ana', spec: 'game@codice@cloud' },
      { id: '4', name: 'tools', server: 'codice@cloud', owner: 'bob', spec: 'tools@codice@cloud' },
    ]);
    expect(commands).toMatchObject([{ via: 'execute', args: ['repository', 'list', 'codice@cloud', '--format={repid}\u001f{repname}\u001f{repserver}\u001f{repowner}\u001e'] }]);
    expect(commands[0]?.options.signal).toBeInstanceOf(AbortSignal);
  });

  it('creates a repository with one command in its documented form for a server, listing none, and returns its spec', async () => {
    const { service, lines } = repositories({ repository: '' });

    expect(await service.create('codice@cloud', 'tools')).toBe('tools@codice@cloud');
    expect(lines()).toEqual(['repository codice@cloud tools']);
  });

  it('fails as cm reports it when the creation fails', async () => {
    const { service } = repositories({ repository: cmFails('Error: The repository tools already exists.') });

    await expect(service.create('codice@cloud', 'tools')).rejects.toThrow('already exists');
  });

  it('renames and deletes a repository by its spec', async () => {
    const { service, lines } = repositories({ repository: '' });

    await service.rename('tools@codice@cloud', 'build-tools');
    await service.remove('tools@codice@cloud');

    expect(lines()).toEqual(['repository rename tools@codice@cloud build-tools', 'repository delete tools@codice@cloud']);
  });
});
