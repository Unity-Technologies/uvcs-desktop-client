import { join } from 'node:path';
import { app } from 'electron';
import type { MergeApi } from '@shared/api/merge';
import type { MergeRequest } from '@shared/domain/merge';
import { readIncomingChangesetPage, readIncomingChanges, readIncomingSummary } from '../merge/incoming';
import { DirectoryDecisions } from '../merge/directoryDecisions';
import { findMergedInto } from '../merge/mergedInto';
import { previewMerge } from '../merge/previewMerge';
import { runMerge } from '../merge/runMerge';
import { updateWithMerge } from '../merge/updateWithMerge';
import { shelveBlockedAndUpdate } from '../workspace/shelveBlockedAndUpdate';
import type { ServiceContext, SwitchContext } from './ServiceContext';

export function createMergeService({ cm, operations, workspaceCopies }: ServiceContext, { switchShelves, leftChanges }: SwitchContext): MergeApi {
  const backupsRoot = join(app.getPath('userData'), 'update-backups');
  const directoryDecisions = new DirectoryDecisions(cm, workspaceCopies);

  return {
    preview: (workspacePath, request) => previewMerge(cm, workspacePath, request, { copies: workspaceCopies }),
    decideDirectoryConflicts: (workspacePath, request, decisionsId, decisions) => directoryDecisions.decide(workspacePath, request, decisionsId, decisions),
    discardDirectoryDecisions: (decisionsId) => directoryDecisions.discard(decisionsId),
    run: (workspacePath, request, resolutions, operationId) =>
      operations.run(operationId, async (context) => {
        const decided = resolutions.directoryDecisionsId === undefined ? undefined : directoryDecisions.stateOf(resolutions.directoryDecisionsId);
        const result = await runMerge(cm, workspacePath, request, resolutions, context, decided);
        // A shelve applied from the merge view (its conflicts resolved): what shelving it away took comes back, and a
        // shelve of left changes, or one to apply and delete, is done.
        const appliedShelve = shelveAppliedToWorkspace(request);
        if (appliedShelve !== null) await leftChanges.finishAppliedShelve(workspacePath, appliedShelve, request.deleteShelve === true);
        return result;
      }),
    mergedInto: (workspacePath, sourceChangeset, destinationBranch) => findMergedInto(cm, workspacePath, sourceChangeset, destinationBranch),
    incomingSummary: (workspacePath, loaded) => readIncomingSummary(cm, workspacePath, loaded),
    incomingChanges: (workspacePath) => readIncomingChanges(cm, workspacePath),
    incomingChangesets: (workspacePath, request) => readIncomingChangesetPage(cm, workspacePath, request),
    updateResolvingConflicts: (workspacePath, resolutions, operationId) =>
      operations.run(operationId, (context) => updateWithMerge(cm, workspacePath, resolutions, backupsRoot, context)),
    shelveBlockedAndUpdate: (workspacePath, resolutions, operationId) =>
      operations.run(operationId, (context) =>
        shelveBlockedAndUpdate({ cm, records: switchShelves, leftChanges, backupsRoot }, workspacePath, resolutions, context),
      ),
  };
}

/** The shelve a merge applies to the workspace (`sh:12`), or null for any other source or a merge into a branch. */
function shelveAppliedToWorkspace({ sourceSpec, destinationBranch }: MergeRequest): number | null {
  const shelve = /^sh:(\d+)$/.exec(sourceSpec);
  return shelve && !destinationBranch ? Number(shelve[1]) : null;
}
