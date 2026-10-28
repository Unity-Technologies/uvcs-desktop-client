import type { ShelvesApi } from '@shared/api/shelves';
import { cmPlace } from '../cm/cmPlace';
import { findArgs } from '../cm/findQuery';
import { FOUND_SHELVES } from '../cm/foundObjects';
import { layoutReader } from '../cm/formatRecords';
import { shelveCommentArgs } from '../cm/shelveCommentArgs';
import { withTempFile } from '../files/tempFile';
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

    // A quick write, run in a pooled `cm shell`: the comment goes in a file, which a shell line can carry.
    editComment(place, shelveId, comment) {
      const at = cmPlace(place);
      return withTempFile(comment, async (commentsFile) => {
        await cm.query(shelveCommentArgs(shelveId, commentsFile, at), at.options);
      });
    },

    delete: (place, shelveId) => leftChanges.discard(place, [shelveId]),
  };
}
