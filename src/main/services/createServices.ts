import type { UvcsApi } from '@shared/api';
import { BranchNamesCache } from '../cm/BranchNamesCache';
import { readBranchNames } from '../cm/branchNames';
import { LeftChangesFinder } from '../workspace/leftChanges';
import { SwitchShelveRecords } from '../workspace/switchShelveRecords';
import { createAccountsService } from './accountsService';
import { createAnnotateService } from './annotateService';
import { createAttributesService } from './attributesService';
import { createBranchExplorerService } from './branchExplorerService';
import { createBranchesService } from './branchesService';
import { createChangesetsService } from './changesetsService';
import { createCodeReviewsService } from './codeReviewsService';
import { createContentService } from './contentService';
import { createDiffService } from './diffService';
import { createExplorerService } from './explorerService';
import { createHistoryService } from './historyService';
import { createLabelsService } from './labelsService';
import { createLeftChangesService } from './leftChangesService';
import { createLocksService } from './locksService';
import { createMergeService } from './mergeService';
import { createMergeToolsService } from './mergeToolsService';
import { createPendingChangesService } from './pendingChangesService';
import { createRepositoriesService } from './repositoriesService';
import { createReviewService } from './reviewService';
import { createSettingsService } from './settingsService';
import { createShelvesService } from './shelvesService';
import { createSyncService } from './syncService';
import { createSystemService } from './systemService';
import { createWindowsService } from './windowsService';
import { createWorkspacesService } from './workspacesService';
import type { BranchNamesContext, ServiceContext, SwitchContext } from './ServiceContext';

export function createServices(context: ServiceContext): UvcsApi {
  const switchShelves = new SwitchShelveRecords(context.settings);
  const switching: SwitchContext = { switchShelves, leftChanges: new LeftChangesFinder(context.cm, switchShelves) };
  const naming: BranchNamesContext = { branchNames: new BranchNamesCache((workspacePath) => readBranchNames(context.cm, workspacePath)) };

  return {
    accounts: createAccountsService(context),
    annotate: createAnnotateService(context),
    attributes: createAttributesService(context),
    branchExplorer: createBranchExplorerService(context, naming),
    branches: createBranchesService(context, naming),
    changesets: createChangesetsService(context),
    codeReviews: createCodeReviewsService(context, naming),
    content: createContentService(context),
    diff: createDiffService(context),
    explorer: createExplorerService(context),
    history: createHistoryService(context),
    labels: createLabelsService(context),
    leftChanges: createLeftChangesService(context, switching),
    locks: createLocksService(context),
    merge: createMergeService(context, switching),
    mergeTools: createMergeToolsService(context),
    pendingChanges: createPendingChangesService(context),
    repositories: createRepositoriesService(context),
    review: createReviewService(context),
    settings: createSettingsService(context),
    shelves: createShelvesService(context),
    sync: createSyncService(context),
    system: createSystemService(context),
    windows: createWindowsService(context),
    workspaces: createWorkspacesService(context, switching),
  };
}
