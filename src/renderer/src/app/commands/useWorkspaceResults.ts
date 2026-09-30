import { Layers } from 'lucide-react';
import { useMemo } from 'react';
import type { WorkspaceSummary } from '@shared/domain/workspace';
import { fuzzyMatchPositions, fuzzyMatchQuality } from '../../lib/fuzzyIndex';
import { workspaceMenu } from '../home/homeMenus';
import { useSettings } from '../settings/useSettings';
import { useOpenWorkspace } from '../workspace/useOpenWorkspace';
import { useWorkspaceList } from '../workspace/workspaceQueries';
import type { SearchGroup, SearchResult } from './searchResults';

/** Other workspaces to switch to: the recent ones, or every workspace whose name matches `term`. */
export function useWorkspaceResults(currentPath: string | null, term: string): SearchGroup {
  const { data: workspaces } = useWorkspaceList();
  const { recentWorkspacePaths } = useSettings();
  const openWorkspace = useOpenWorkspace();

  const results = useMemo(
    () => workspaceResults(workspaces ?? [], recentWorkspacePaths, currentPath, term, openWorkspace),
    // `openWorkspace` is a fresh function every render but always does the same.
    [workspaces, recentWorkspacePaths, currentPath, term],
  );

  return { section: 'workspaces', heading: 'Workspaces', results };
}

/** Every workspace but the current one: the recent ones in the order last used, or those whose name matches `term`. */
export function workspaceResults(
  workspaces: readonly WorkspaceSummary[],
  recentPaths: readonly string[],
  currentPath: string | null,
  term: string,
  open: (path: string) => void,
): SearchResult[] {
  const others = workspaces.filter((workspace) => workspace.path !== currentPath);
  const shown = term
    ? others.filter((workspace) => fuzzyMatchPositions(workspace.name, term).length > 0)
    : recentPaths.flatMap((path) => others.find((workspace) => workspace.path === path) ?? []);
  return shown.map((workspace) => workspaceResult(workspace, term, open));
}

function workspaceResult(workspace: WorkspaceSummary, term: string, open: (path: string) => void): SearchResult {
  return {
    id: `workspace:${workspace.guid}`,
    icon: Layers,
    label: workspace.name,
    labelMatches: fuzzyMatchPositions(workspace.name, term),
    detail: workspace.path,
    detailMatches: [],
    quality: term ? fuzzyMatchQuality(workspace.name, term) : undefined,
    menu: () => workspaceMenu(workspace, open),
    run: () => open(workspace.path),
  };
}
