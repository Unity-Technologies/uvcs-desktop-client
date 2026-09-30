import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { OperationProgress } from '@shared/domain/operation';
import { fakeCmClient, runsUntilCancelled, type CmAnswer } from '../cm/testing/fakeCmClient';
import { OperationTracker } from '../operations/OperationTracker';
import { createSyncService } from './syncService';
import { serviceContext } from './testing/serviceContext';

const WORKSPACE = join(tmpdir(), 'wkspaces', 'game');

function sync(answers: Record<string, CmAnswer>, operations?: OperationTracker) {
  const fake = fakeCmClient(answers);
  const context = serviceContext(fake.cm, operations ? { operations } : {});
  return { ...fake, service: createSyncService(context), operations: context.operations };
}

const REPLICATED = 'Changesets 3\nLabels 1\nItems 12\n';

describe('replication', () => {
  it('pushes a branch with one cm push of its own process and reads what it sent', async () => {
    const { service, commands } = sync({ push: REPLICATED });

    const summary = await service.push(WORKSPACE, { branch: '/main/task1', from: 'game@local', to: 'game@cloud' }, 'op-1');

    expect(summary).toEqual({ changesets: 3, labels: 1, items: 12 });
    expect(commands).toMatchObject([{ via: 'execute', args: ['push', 'br:/main/task1@game@local', 'game@cloud'], options: { cwd: WORKSPACE } }]);
    expect(commands[0]?.options.signal).toBeInstanceOf(AbortSignal);
  });

  it('pulls a branch with one cm pull of its own process', async () => {
    const { service, commands } = sync({ pull: 'Changesets 0\n' });

    expect(await service.pull(WORKSPACE, { branch: '/main', from: 'game@cloud', to: 'game@local' }, 'op-1')).toEqual({ changesets: 0, labels: 0, items: 0 });
    expect(commands).toMatchObject([{ via: 'execute', args: ['pull', 'br:/main@game@cloud', 'game@local'] }]);
  });

  it('can be cancelled', async () => {
    const { service, operations } = sync({
      push: runsUntilCancelled('Error: Aborted'),
    });

    const pushing = service.push(WORKSPACE, { branch: '/main', from: 'game@local', to: 'game@cloud' }, 'op-3');
    operations.cancel('op-3');

    await expect(pushing).rejects.toThrow('Aborted');
  });

  it('reports its stages as the operation progresses', async () => {
    const progress: OperationProgress[] = [];
    const tracker = new OperationTracker((_id, report) => progress.push(report), () => undefined);
    const { service } = sync(
      {
        push: ({ options }) => {
          options.onOutputLine?.('<STAGE:Fetching changesets>');
          return REPLICATED;
        },
      },
      tracker,
    );

    await service.push(WORKSPACE, { branch: '/main', from: 'game@local', to: 'game@cloud' }, 'op-1');

    expect(progress.at(-1)).toMatchObject({ stage: 'working', stageLabel: 'Fetching changesets' });
  });
});

describe('Git sync', () => {
  it('syncs with a Git remote with one cm sync of its own process, credentials only when given', async () => {
    const { service, commands } = sync({ sync: '' });

    await service.syncWithGit(WORKSPACE, { repository: 'game@local', url: 'https://github.com/acme/game.git' }, 'op-1');
    await service.syncWithGit(WORKSPACE, { repository: 'game@local', url: 'https://github.com/acme/game.git', user: 'dani', password: 's3cret' }, 'op-2');

    expect(commands.map(({ via, args }) => [via, args])).toEqual([
      ['execute', ['sync', 'game@local', 'git', 'https://github.com/acme/game.git']],
      ['execute', ['sync', 'game@local', 'git', 'https://github.com/acme/game.git', '--user=dani', '--pwd=s3cret']],
    ]);
  });
});
