import type { BranchesApi } from '@shared/api/branches';
import { findArgs } from '../cm/findQuery';
import { findRecords, toBranch } from '../cm/findObjects';
import type { ServiceContext } from './ServiceContext';

export function createBranchesService({ cm }: ServiceContext): BranchesApi {
  return {
    async list(workspacePath, filter) {
      const hidden = filter.includeHidden ? [] : ["hidden = 'false'"];
      const xml = await cm.query(findArgs('branch', { ...filter, branch: undefined }, 'date desc', hidden), { cwd: workspacePath });
      return findRecords(xml, 'BRANCH').map(toBranch);
    },
  };
}
