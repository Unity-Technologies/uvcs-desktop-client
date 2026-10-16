import type { ShelvesApi } from '@shared/api/shelves';
import { findArgs } from '../cm/findQuery';
import { FOUND_SHELVES } from '../cm/foundObjects';
import { readRecords } from '../cm/formatRecords';
import type { ServiceContext, SwitchContext } from './ServiceContext';

export function createShelvesService({ cm, operations }: ServiceContext, { leftChanges }: SwitchContext): ShelvesApi {
  return {
    async list(workspacePath, filter) {
      const output = await cm.query(findArgs(FOUND_SHELVES, { ...filter, branch: undefined }, null), { cwd: workspacePath });
      return readRecords(FOUND_SHELVES, output).sort((a, b) => b.id - a.id);
    },

    apply: (workspacePath, shelveId, deleteShelve, operationId) =>
      operations.run(operationId, (context) => leftChanges.apply(workspacePath, shelveId, deleteShelve, context)),

    delete: (workspacePath, shelveId) => leftChanges.discard(workspacePath, [shelveId]),
  };
}
