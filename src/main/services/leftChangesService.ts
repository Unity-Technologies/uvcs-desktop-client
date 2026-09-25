import type { LeftChangesApi } from '@shared/api/leftChanges';
import type { ServiceContext, SwitchContext } from './ServiceContext';

export function createLeftChangesService({ operations }: ServiceContext, { leftChanges }: SwitchContext): LeftChangesApi {
  return {
    find: (workspacePath) => leftChanges.find(workspacePath),
    restore: (workspacePath, shelveId, operationId) => operations.run(operationId, (context) => leftChanges.restore(workspacePath, shelveId, context)),
    discard: (workspacePath, shelveIds) => leftChanges.discard(workspacePath, shelveIds),
  };
}
