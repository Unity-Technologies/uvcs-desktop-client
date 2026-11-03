import { create } from 'zustand';

/** The asset whose `.meta` diff Changes shows instead of its own, asked for from its menu ("Open .meta diff"). */
interface MetaDiffRequest {
  workspacePath: string;
  /** The asset's path, as Changes lists it (`PendingChange.path`). */
  path: string;
}

export const useMetaDiffRequests = create<{ request: MetaDiffRequest | null }>(() => ({ request: null }));

/** Asks Changes to show the `.meta` diff of this asset: it shows it while that asset stays shown. */
export function requestMetaDiff(workspacePath: string, path: string): void {
  useMetaDiffRequests.setState({ request: { workspacePath, path } });
}

/** Whether the `.meta` diff was asked for this asset of this workspace. */
export function metaDiffRequestedFor(request: MetaDiffRequest | null, workspacePath: string, path: string): boolean {
  return request !== null && request.workspacePath === workspacePath && request.path === path;
}
