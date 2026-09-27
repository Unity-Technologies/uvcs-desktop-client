import type { ShelvesApi } from '@shared/api/shelves';
import { findArgs } from '../cm/findQuery';
import { findRecords, toShelve } from '../cm/findObjects';
import type { ServiceContext, SwitchContext } from './ServiceContext';

export function createShelvesService({ cm, operations }: ServiceContext, { leftChanges }: SwitchContext): ShelvesApi {
  return {
    async list(workspacePath, filter) {
      const xml = await cm.query(findArgs('shelve', { ...filter, branch: undefined }, null), { cwd: workspacePath });
      return findRecords(xml, 'SHELVE')
        .map(toShelve)
        .sort((a, b) => b.id - a.id);
    },

    apply: (workspacePath, shelveId, deleteShelve, operationId) =>
      operations.run(operationId, (context) => leftChanges.apply(workspacePath, shelveId, deleteShelve, context)),

    delete: (workspacePath, shelveId) => leftChanges.discard(workspacePath, [shelveId]),
  };
}
