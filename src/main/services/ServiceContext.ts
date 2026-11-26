import type { ServerSessions } from '../accounts/ServerSessions';
import type { SessionChecks } from '../accounts/SessionChecks';
import type { BranchNamesCache } from '../cm/BranchNamesCache';
import type { CmClient } from '../cm/CmClient';
import type { RepositoryGuids } from '../cm/RepositoryGuids';
import type { CmRuntime } from '../cmRuntime/CmRuntime';
import type { DiagnosticWriter } from '../diagnostics/DiagnosticLog';
import type { ProfileList } from '../cm/ProfileList';
import type { IssueTrackers } from '../issueTrackers/IssueTrackers';
import type { OperationTracker } from '../operations/OperationTracker';
import type { RevisionCat } from '../files/RevisionCat';
import type { WorkspaceCopies } from '../files/WorkspaceCopies';
import type { DiffReviewStore } from '../review/DiffReviewStore';
import type { ReviewStore } from '../review/ReviewStore';
import type { SettingsStore } from '../settings/SettingsStore';
import type { AppIcons } from '../system/apps/AppIcons';
import type { ExternalAppsCatalog } from '../system/apps/ExternalAppsCatalog';
import type { InstalledAppsCache } from '../system/apps/installedApps';
import type { AppUpdates } from '../update/AppUpdates';
import type { RepositoryPathSearch } from '../files/RepositoryPathSearch';
import type { RepositoryTrees } from '../unity/RepositoryTrees';
import type { RevisionDownloads } from '../unity/RevisionDownloads';
import type { WorkspaceWatchers } from '../watch/WorkspaceWatchers';
import type { HandedOverDiffs } from '../window/HandedOverDiffs';
import type { WorkspaceWindows } from '../window/WorkspaceWindows';
import type { LeftChangesFinder } from '../workspace/leftChanges';
import type { WorkspaceHeaders } from '../workspace/WorkspaceHeaders';
import type { SwitchShelveRecords } from '../workspace/switchShelveRecords';

/** Shared dependencies handed to every service. */
export interface ServiceContext {
  cm: CmClient;
  operations: OperationTracker;
  reviews: ReviewStore;
  diffReviews: DiffReviewStore;
  settings: SettingsStore;
  watchers: WorkspaceWatchers;
  windows: WorkspaceWindows;
  /** The diffs a window hands to the page window it opens, read once there instead of with `cm diff` (`HandedOverDiffs`). */
  handedOverDiffs: HandedOverDiffs;
  headers: WorkspaceHeaders;
  /** The revisions listings named, read from the workspace's disk where its files are those revisions (`WorkspaceCopies`). */
  workspaceCopies: WorkspaceCopies;
  /** Revisions saved with `cm cat`, the ones asked together in one command (`RevisionCat`). */
  revisionCat: RevisionCat;
  /** The revisions the Materials look reads at a version's point, downloaded in batches and kept for the session. */
  revisionDownloads: RevisionDownloads;
  /** The repository's trees at the points a model viewer reads, listed once each and shared (`RepositoryTrees`). */
  repositoryTrees: RepositoryTrees;
  /** A repository's files found by name, its trees listed once per changeset into the session's files (`RepositoryPathSearch`). */
  repositoryPaths: RepositoryPathSearch;
  updates: AppUpdates;
  cmRuntime: CmRuntime;
  /** Branch names by object id, kept while a window shows the workspace (`BranchNamesCache`). */
  branchNames: BranchNamesCache;
  /** Every listing of a server's repositories, and the repositories' GUIDs it teaches (`RepositoryGuids`). */
  repositoryGuids: RepositoryGuids;
  /** The issue trackers' engine: connections, bindings and issue reads (`IssueTrackers`). */
  issueTrackers: IssueTrackers;
  /** The log file a user sends with a bug report (`appLog`). */
  diagnosticLog: DiagnosticWriter;
  /** The servers' sign-in state and its checks (`trackSignIns`). */
  signIns: SignInContext;
}

/**
 * Branch names by object id (code reviews name their branches by id), shared by the services that read branches
 * so a list already read answers the lookups.
 */
export interface BranchNamesContext {
  branchNames: BranchNamesCache;
}

/** The servers' sign-in state, one for the app, and the checks that keep it (`trackSignIns`). */
export interface SignInContext {
  sessions: ServerSessions;
  sessionChecks: SessionChecks;
}

/** `cm profile list`, one read shared by the accounts, the servers and the setup check (`ProfileList`). */
export interface ProfilesContext {
  profiles: ProfileList;
}

/** What switching with pending changes shares across services: its shelve records and the left-changes lookup. */
export interface SwitchContext {
  switchShelves: SwitchShelveRecords;
  leftChanges: LeftChangesFinder;
}

/**
 * The OS's records of installed apps, read once for the merge tools and the apps files open in, those apps, and their
 * icons, shared by the services that offer apps.
 */
export interface AppsContext {
  installedApps: InstalledAppsCache;
  apps: ExternalAppsCatalog;
  icons: AppIcons;
}
