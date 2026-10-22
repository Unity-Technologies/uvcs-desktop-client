import { useEffect, useState } from 'react';
import { create } from 'zustand';
import type { FocusedLines } from '../../app/navigation/pages';

/** Lines of a pending change to show, asked for from outside Changes: a link's (`uvcs:///wk/-/changes/a.cs#L42`). */
interface LineFocusRequest {
  workspacePath: string;
  /** The change's path, as Changes lists it (`PendingChange.path`). */
  path: string;
  lines: FocusedLines;
}

const useLineFocusRequests = create<{ request: LineFocusRequest | null }>(() => ({ request: null }));

/**
 * Asks Changes to show lines of a pending change: its diff scrolls to them and marks them once it shows that change
 * (select it with `selectInView(workspacePath, 'changes', …)` and go to Changes). One request at a time, taken once.
 */
export function requestLineFocus(workspacePath: string, path: string, lines: FocusedLines): void {
  useLineFocusRequests.setState({ request: { workspacePath, path, lines } });
}

/** The request, if it is for this change of this workspace. */
export function lineFocusRequestFor(request: LineFocusRequest | null, workspacePath: string, path: string): FocusedLines | undefined {
  return request && request.workspacePath === workspacePath && request.path === path ? request.lines : undefined;
}

/**
 * The lines asked for in the change a diff shows (`requestLineFocus`), taken once it shows it; dropped once it shows
 * another, so coming back leaves the diff where the user left it.
 */
export function useRequestedLineFocus(workspacePath: string, path: string): FocusedLines | undefined {
  const request = useLineFocusRequests((state) => state.request);
  const [taken, setTaken] = useState<{ path: string; lines: FocusedLines } | null>(null);
  useEffect(() => {
    const lines = lineFocusRequestFor(request, workspacePath, path);
    if (!lines) return;
    setTaken({ path, lines });
    useLineFocusRequests.setState({ request: null });
  }, [request, workspacePath, path]);
  useEffect(() => {
    if (taken && taken.path !== path) setTaken(null);
  }, [taken, path]);
  return taken?.path === path ? taken.lines : undefined;
}
