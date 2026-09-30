import type { CmClient } from '../../cm/CmClient';
import { OperationTracker } from '../../operations/OperationTracker';
import type { ServiceContext } from '../ServiceContext';

/** A `ServiceContext` for a service test: its `cm`, a real `OperationTracker`, and whatever else the service uses. */
export function serviceContext(cm: CmClient, parts: Partial<ServiceContext> = {}): ServiceContext {
  const operations = new OperationTracker(
    () => undefined,
    () => undefined,
  );
  return { cm, operations, ...parts } as ServiceContext;
}
