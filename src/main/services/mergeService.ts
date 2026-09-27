import { join } from 'node:path';
import { app } from 'electron';
import type { MergeApi } from '@shared/api/merge';
import { readIncomingChanges, readIncomingSummary } from '../merge/incoming';
import { findMergedInto } from '../merge/mergedInto';
import { previewMerge } from '../merge/previewMerge';
import { runMerge } from '../merge/runMerge';
import { updateWithMerge } from '../merge/updateWithMerge';
import { shelveBlockedAndUpdate } from '../workspace/shelveBlockedAndUpdate';
import type { ServiceContext, SwitchContext } from './ServiceContext';

export function createMergeService({ cm, operations }: ServiceContext, { switchShelves, leftChanges }: SwitchContext): MergeApi {
  const backupsRoot = join(app.getPath('userData'), 'update-backups');

  return {
    preview: (workspacePath, request) => previewMerge(cm, workspacePath, request),
    run: (workspacePath, request, resolutions, operationId) =>
      operations.run(operationId, async (context) => {
        const result = await runMerge(cm, workspacePath, request, resolutions, context);
        // A switch shelve applied from the merge view (its conflicts resolved) has done its job.
        const shelve = /^sh:(\d+)$/.exec(request.sourceSpec);
        if (shelve && !request.destinationBranch) await leftChanges.finishAppliedShelve(workspacePath, Number(shelve[1]));
        return result;
      }),
    mergedInto: (workspacePath, sourceChangeset, destinationBranch) => findMergedInto(cm, workspacePath, sourceChangeset, destinationBranch),
    incomingSummary: (workspacePath, loaded) => readIncomingSummary(cm, workspacePath, loaded),
    incomingChanges: (workspacePath) => readIncomingChanges(cm, workspacePath),
    updateResolvingConflicts: (workspacePath, resolutions, operationId) =>
      operations.run(operationId, (context) => updateWithMerge(cm, workspacePath, resolutions, backupsRoot, context)),
    shelveBlockedAndUpdate: (workspacePath, resolutions, operationId) =>
      operations.run(operationId, (context) =>
        shelveBlockedAndUpdate({ cm, records: switchShelves, leftChanges, backupsRoot }, workspacePath, resolutions, context),
      ),
  };
}
