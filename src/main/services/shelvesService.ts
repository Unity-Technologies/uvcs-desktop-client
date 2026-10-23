import type { ShelvesApi } from '@shared/api/shelves';
import { cmPlace } from '../cm/cmPlace';
import { findArgs } from '../cm/findQuery';
import { FOUND_SHELVES } from '../cm/foundObjects';
import { layoutReader } from '../cm/formatRecords';
import type { ServiceContext, SwitchContext } from './ServiceContext';

export function createShelvesService({ cm, operations }: ServiceContext, { leftChanges }: SwitchContext): ShelvesApi {
  return {
    async list(place, filter) {
      const at = cmPlace(place);
      const shelves = await cm.queryRecords(findArgs(FOUND_SHELVES, { ...filter, branch: undefined }, null, [], at.repository), layoutReader(FOUND_SHELVES), at.options);
      return shelves.sort((a, b) => b.id - a.id);
    },

    apply: (workspacePath, shelveId, deleteShelve, operationId) =>
      operations.run(operationId, (context) => leftChanges.apply(workspacePath, shelveId, deleteShelve, context)),

    delete: (place, shelveId) => leftChanges.discard(place, [shelveId]),
  };
}
