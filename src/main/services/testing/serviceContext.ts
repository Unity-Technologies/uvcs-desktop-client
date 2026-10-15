import { RepositoryTrees } from '../../unity/RepositoryTrees';
import type { CmClient } from '../../cm/CmClient';
import { WorkspaceCopies } from '../../files/WorkspaceCopies';
import { OperationTracker } from '../../operations/OperationTracker';
import { ProfileList } from '../../cm/ProfileList';
import type { ProfilesContext, ServiceContext } from '../ServiceContext';

/** A `ServiceContext` for a service test: its `cm`, a real `OperationTracker`, and whatever else the service uses. */
export function serviceContext(cm: CmClient, parts: Partial<ServiceContext> = {}): ServiceContext {
  const operations = new OperationTracker(
    () => undefined,
    () => undefined,
  );
  // Nothing downloads in a service's test unless it says so: the trees list through its fake `cm`.
  const downloads = { read: () => Promise.reject(new Error('Nothing downloads here')) };
  return { cm, operations, repositoryTrees: new RepositoryTrees({ cm, downloads }), workspaceCopies: new WorkspaceCopies({ cm }), ...parts } as ServiceContext;
}

/** The profiles read the accounts, the servers and the setup check share, over the test's `cm`. */
export function profilesContext(cm: CmClient): ProfilesContext {
  return { profiles: new ProfileList(cm) };
}
