import { RepositoryTrees } from '../../unity/RepositoryTrees';
import type { CmClient } from '../../cm/CmClient';
import { OrganizationServers } from '../../cm/organizationServers';
import { OperationTracker } from '../../operations/OperationTracker';
import type { ServiceContext } from '../ServiceContext';

/** A `ServiceContext` for a service test: its `cm`, a real `OperationTracker`, and whatever else the service uses. */
export function serviceContext(cm: CmClient, parts: Partial<ServiceContext> = {}): ServiceContext {
  const operations = new OperationTracker(
    () => undefined,
    () => undefined,
  );
  // Nothing downloads in a service's test unless it says so: the trees list through its fake `cm`.
  const downloads = { read: () => Promise.reject(new Error('Nothing downloads here')) };
  return { cm, operations, repositoryTrees: new RepositoryTrees({ cm, downloads }), organizations: new OrganizationServers(cm), ...parts } as ServiceContext;
}
