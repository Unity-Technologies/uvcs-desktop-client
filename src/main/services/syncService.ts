import type { SyncApi } from '@shared/api/sync';
import type { ReplicationSummary } from '@shared/domain/replication';
import { readActivityProgress } from '../cm/progress/activityProgress';
import { parseReplicationSummary } from '../cm/replicationSummary';
import type { ServiceContext } from './ServiceContext';

export function createSyncService({ cm, operations }: ServiceContext): SyncApi {
  function replicate(workspacePath: string, args: string[], operationId: string): Promise<ReplicationSummary> {
    return operations.run(operationId, async ({ signal, progressOf }) => {
      const output = await cm.execute(args, { cwd: workspacePath, signal, onOutputLine: progressOf(readActivityProgress) });
      return parseReplicationSummary(output);
    });
  }

  return {
    push: (workspacePath, request, operationId) =>
      replicate(workspacePath, ['push', `br:${request.branch}@${request.from}`, request.to], operationId),

    pull: (workspacePath, request, operationId) =>
      replicate(workspacePath, ['pull', `br:${request.branch}@${request.from}`, request.to], operationId),

    syncWithGit: (workspacePath, request, operationId) =>
      operations.run(operationId, async ({ signal, progressOf }) => {
        const credentials = request.user ? [`--user=${request.user}`, `--pwd=${request.password ?? ''}`] : [];
        await cm.execute(['sync', request.repository, 'git', request.url, ...credentials], {
          cwd: workspacePath,
          signal,
          onOutputLine: progressOf(readActivityProgress),
        });
      }),
  };
}
