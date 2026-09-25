import type { ChangesetsApi } from '@shared/api/changesets';
import { findArgs } from '../cm/findQuery';
import { findRecords, toChangeset } from '../cm/findObjects';
import type { ServiceContext } from './ServiceContext';

export function createChangesetsService({ cm }: ServiceContext): ChangesetsApi {
  return {
    async list(workspacePath, filter) {
      const xml = await cm.query(findArgs('changeset', filter, 'changesetid desc'), { cwd: workspacePath });
      return findRecords(xml, 'CHANGESET').map(toChangeset);
    },
  };
}
