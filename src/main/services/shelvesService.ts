import type { ShelvesApi } from '@shared/api/shelves';
import { findArgs } from '../cm/findQuery';
import { findRecords, toShelve } from '../cm/findObjects';
import type { ServiceContext } from './ServiceContext';

export function createShelvesService({ cm }: ServiceContext): ShelvesApi {
  return {
    async list(workspacePath, filter) {
      const xml = await cm.query(findArgs('shelve', { ...filter, branch: undefined }, null), { cwd: workspacePath });
      return findRecords(xml, 'SHELVE')
        .map(toShelve)
        .sort((a, b) => b.id - a.id);
    },
  };
}
