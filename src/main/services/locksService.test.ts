import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOCK_LIST_FORMAT_ARGS } from '../cm/lockRecords';
import { formatOutput } from '../cm/testing/cmOutput';
import { fakeCmClient, type CmAnswer } from '../cm/testing/fakeCmClient';
import { createLocksService } from './locksService';
import { serviceContext } from './testing/serviceContext';

const WORKSPACE = join(tmpdir(), 'wkspaces', 'game');

function locks(answers: Record<string, CmAnswer>) {
  const fake = fakeCmClient(answers);
  return { ...fake, service: createLocksService(serviceContext(fake.cm)) };
}

describe('locks', () => {
  it("lists the repository's locks in any status with one quick command", async () => {
    // A `cm lock list` record in the smart-locks machine-readable layout.
    const output = formatOutput(['game', '118', 'f1d0', '2026-09-25T10:00:00+02:00', '/main', '', '/main/task1', '', 'Locked', 'ana', 'ana-wk', '/art/Hero.fbx']);
    const { service, commands } = locks({ 'lock list': output });

    const listed = await service.list(WORKSPACE, 'game@acme@cloud', { onlyMine: false });

    expect(commands).toMatchObject([{ via: 'query', args: ['lock', 'list', '--anystatus', '--repository=game@acme@cloud', ...LOCK_LIST_FORMAT_ARGS], options: { cwd: WORKSPACE } }]);
    expect(listed).toEqual([
      {
        repository: 'game@acme@cloud',
        itemId: 118,
        guid: 'f1d0',
        date: '2026-09-25T10:00:00+02:00',
        destinationBranch: '/main',
        holderBranch: '/main/task1',
        status: 'Locked',
        owner: 'ana',
        workspace: 'ana-wk',
        path: '/art/Hero.fbx',
      },
    ]);
  });

  it("narrows the list to the user's own locks, or this workspace's, on the server", async () => {
    const { service, lines } = locks({ 'lock list': '' });

    await service.list(WORKSPACE, 'game@local', { onlyMine: true, onlyThisWorkspace: true });

    expect(lines()[0]).toContain('--onlycurrentuser --onlycurrentworkspace');
  });

  it('releases several locks, each named in its repository, with one command', async () => {
    const { service, lines } = locks({ 'lock unlock': '' });

    await service.unlock(WORKSPACE, [
      { itemId: 118, repository: 'game@local' },
      { itemId: 7, repository: 'lib@local' },
    ], { remove: false });
    await service.unlock(WORKSPACE, [{ itemId: 118, repository: 'game@local' }], { remove: true });

    expect(lines()).toEqual(['lock unlock itemid:118@game@local itemid:7@lib@local', 'lock unlock itemid:118@game@local --remove']);
  });
});
