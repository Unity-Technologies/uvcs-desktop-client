import type { UvcsApi } from '@shared/api';
import { createAnnotateService } from './annotateService';
import { createAttributesService } from './attributesService';
import { createBranchesService } from './branchesService';
import { createChangesetsService } from './changesetsService';
import { createCodeReviewsService } from './codeReviewsService';
import { createContentService } from './contentService';
import { createDiffService } from './diffService';
import { createExplorerService } from './explorerService';
import { createHistoryService } from './historyService';
import { createLabelsService } from './labelsService';
import { createLocksService } from './locksService';
import { createMergeService } from './mergeService';
import { createPendingChangesService } from './pendingChangesService';
import { createRepositoriesService } from './repositoriesService';
import { createSettingsService } from './settingsService';
import { createShelvesService } from './shelvesService';
import { createSyncService } from './syncService';
import { createSystemService } from './systemService';
import { createWorkspacesService } from './workspacesService';
import type { ServiceContext } from './ServiceContext';

export function createServices(context: ServiceContext): UvcsApi {
  return {
    annotate: createAnnotateService(context),
    attributes: createAttributesService(context),
    branches: createBranchesService(context),
    changesets: createChangesetsService(context),
    codeReviews: createCodeReviewsService(context),
    content: createContentService(context),
    diff: createDiffService(context),
    explorer: createExplorerService(context),
    history: createHistoryService(context),
    labels: createLabelsService(context),
    locks: createLocksService(context),
    merge: createMergeService(context),
    pendingChanges: createPendingChangesService(context),
    repositories: createRepositoriesService(context),
    settings: createSettingsService(context),
    shelves: createShelvesService(context),
    sync: createSyncService(context),
    system: createSystemService(context),
    workspaces: createWorkspacesService(context),
  };
}
