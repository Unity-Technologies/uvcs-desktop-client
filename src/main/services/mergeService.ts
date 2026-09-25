import { join } from 'node:path';
import { app } from 'electron';
import type { MergeApi } from '@shared/api/merge';
import { readIncomingChanges, readIncomingSummary } from '../merge/incoming';
import { previewMerge } from '../merge/previewMerge';
import { runMerge } from '../merge/runMerge';
import { updateWithMerge } from '../merge/updateWithMerge';
import type { ServiceContext } from './ServiceContext';

export function createMergeService({ cm, operations }: ServiceContext): MergeApi {
  const backupsRoot = join(app.getPath('userData'), 'update-backups');

  return {
    preview: (workspacePath, request) => previewMerge(cm, workspacePath, request),
    run: (workspacePath, request, resolutions, operationId) =>
      operations.run(operationId, (context) => runMerge(cm, workspacePath, request, resolutions, context)),
    incomingSummary: (workspacePath) => readIncomingSummary(cm, workspacePath),
    incomingChanges: (workspacePath) => readIncomingChanges(cm, workspacePath),
    updateResolvingConflicts: (workspacePath, resolutions, operationId) =>
      operations.run(operationId, (context) => updateWithMerge(cm, workspacePath, resolutions, backupsRoot, context)),
  };
}
