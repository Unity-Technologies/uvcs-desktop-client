import { useEffect } from 'react';
import { create } from 'zustand';
import { useDiffMetaShownFor } from '../diff/useDiffMetaShownFor';

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

/**
 * The asset whose `.meta` the diff shows: the one a request asks for (`requestMetaDiff`), taken once it shows it, or
 * the one the diff's own toggle picked. Showing another asset forgets it, so coming back shows the asset's own diff.
 */
export function useMetaShownFor(workspacePath: string, path: string): [string | null, (shownFor: string | null) => void] {
  const request = useMetaDiffRequests((state) => state.request);
  const [shownFor, setShownFor] = useDiffMetaShownFor(path);
  useEffect(() => {
    if (!metaDiffRequestedFor(request, workspacePath, path)) return;
    setShownFor(path);
    useMetaDiffRequests.setState({ request: null });
  }, [request, workspacePath, path, setShownFor]);
  return [shownFor, setShownFor];
}
