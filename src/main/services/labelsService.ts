import type { LabelsApi } from '@shared/api/labels';
import { findArgs } from '../cm/findQuery';
import { findRecords, toLabel } from '../cm/findObjects';
import type { ServiceContext } from './ServiceContext';

export function createLabelsService({ cm }: ServiceContext): LabelsApi {
  return {
    async list(workspacePath, filter) {
      const xml = await cm.query(findArgs('label', filter, 'date desc'), { cwd: workspacePath });
      return findRecords(xml, 'MARKER').map(toLabel);
    },
  };
}
