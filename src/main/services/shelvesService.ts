import type { ShelvesApi } from '@shared/api/shelves';
import { findArgs } from '../cm/findQuery';
import { findRecords, toShelve } from '../cm/findObjects';
import { parseShelveApplyPreview } from '../cm/shelveApplyPreview';
import type { ServiceContext } from './ServiceContext';

export function createShelvesService({ cm, operations }: ServiceContext): ShelvesApi {
  return {
    async list(workspacePath, filter) {
      const xml = await cm.query(findArgs('shelve', { ...filter, branch: undefined }, null), { cwd: workspacePath });
      return findRecords(xml, 'SHELVE')
        .map(toShelve)
        .sort((a, b) => b.id - a.id);
    },

    async previewApply(workspacePath, shelveId) {
      const output = await cm.query(['shelveset', 'apply', `sh:${shelveId}`, '--preview'], { cwd: workspacePath });
      return parseShelveApplyPreview(output);
    },

    apply(workspacePath, shelveId, operationId) {
      return operations.run(operationId, async ({ signal, reportProgress }) => {
        await cm.execute(['shelveset', 'apply', `sh:${shelveId}`], { cwd: workspacePath, signal, onOutputLine: reportProgress });
      });
    },

    async delete(workspacePath, shelveId) {
      await cm.query(['shelveset', 'delete', `sh:${shelveId}`], { cwd: workspacePath });
    },
  };
}
