import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ServerSessions } from '../../accounts/ServerSessions';
import type { IssueTrackers } from '../../issueTrackers/IssueTrackers';
import { DiffReviewStore } from '../../review/DiffReviewStore';
import { SessionChecks } from '../../accounts/SessionChecks';
import { checkConnection } from '../../cm/connectionCheck';
import { RepositoryTrees } from '../../unity/RepositoryTrees';
import type { CmClient } from '../../cm/CmClient';
import { listRepositories } from '../../cm/listRepositories';
import { repositoryIdOf } from '../../cm/repositoryIdOf';
import { RepositoryGuids } from '../../cm/RepositoryGuids';
import { RevisionCat } from '../../files/RevisionCat';
import { WorkspaceCopies } from '../../files/WorkspaceCopies';
import { OperationTracker } from '../../operations/OperationTracker';
import { ProfileList } from '../../cm/ProfileList';
import { HandedOverDiffs } from '../../window/HandedOverDiffs';
import { cmHeaderReaders, WorkspaceHeaders } from '../../workspace/WorkspaceHeaders';
import type { ProfilesContext, ServiceContext, SignInContext } from '../ServiceContext';

/**
 * A `ServiceContext` for a service test: its `cm`, a real `OperationTracker`, the workspace headers read through that
 * `cm` (`cm getworkspacefrompath`: answer it with `cmOutput.WORKSPACE_NAMES`), and whatever else the service uses.
 */
export function serviceContext(cm: CmClient, parts: Partial<ServiceContext> = {}): ServiceContext {
  const operations = new OperationTracker(
    () => undefined,
    () => undefined,
  );
  // Nothing downloads in a service's test unless it says so: the trees list through its fake `cm`.
  const downloads = { read: () => Promise.reject(new Error('Nothing downloads here')) };
  // What a repository kept by spec is moved by when its GUID is first known (`repositoryGuidOf`): a store of review marks
  // in the run's temp folder, and no issue tracker unless the test says so.
  const diffReviews = new DiffReviewStore(mkdtempSync(join(tmpdir(), 'diff-reviews-')));
  const issueTrackers = { keepRepositoryByGuid: () => undefined } as unknown as IssueTrackers;
  return { cm, operations, diffReviews, issueTrackers, repositoryTrees: new RepositoryTrees({ cm, downloads }), workspaceCopies: new WorkspaceCopies({ cm }), revisionCat: new RevisionCat({ cm }), handedOverDiffs: new HandedOverDiffs(), headers: new WorkspaceHeaders(cmHeaderReaders(cm)), diagnosticLog: { write: () => undefined }, signIns: signInContext(cm), repositoryGuids: new RepositoryGuids({ list: (server) => listRepositories(cm, server), idOf: (spec, server) => repositoryIdOf(cm, spec, server) }), organizationRenames: { listed: async () => undefined, follow: async () => undefined }, ...parts } as ServiceContext;
}

/** The servers' sign-in state, checked with `cm checkconnection` through the test's `cm`. */
export function signInContext(cm: CmClient, now?: () => number): SignInContext {
  const sessions = new ServerSessions();
  return { sessions, sessionChecks: new SessionChecks({ check: (server) => checkConnection(cm, server), sessions, restartShells: () => cm.restartShells(), now }) };
}

/** The profiles read the accounts, the servers and the setup check share, over the test's `cm`. */
export function profilesContext(cm: CmClient): ProfilesContext {
  return { profiles: new ProfileList(cm) };
}
