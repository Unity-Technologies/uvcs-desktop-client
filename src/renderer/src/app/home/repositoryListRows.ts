import type { RepositorySummary } from '@shared/domain/repository';
import type { WorkspaceSummary } from '@shared/domain/workspace';
import { navigationTarget } from '../../lib/listNavigation';
import { matchesAllWords } from '../../lib/matchesAllWords';

/**
 * A row of the home screen's repositories, read as one flat list so that only the rows in view render (a server
 * holds thousands of repositories): a repository, then, while it's expanded, its workspaces and the action to add one.
 */
export type RepositoryListRow =
  | { kind: 'repository'; repository: RepositorySummary; workspaces: WorkspaceSummary[]; expanded: boolean }
  | { kind: 'workspace'; repository: RepositorySummary; workspace: WorkspaceSummary }
  | { kind: 'newWorkspace'; repository: RepositorySummary };

const NO_WORKSPACES: WorkspaceSummary[] = [];

/** The workspaces known to work on each repository, by its spec (`name@server`), each looked up at once. */
export function workspacesByRepository(entries: readonly { workspace: WorkspaceSummary; repository?: string | null }[]): Map<string, WorkspaceSummary[]> {
  const byRepository = new Map<string, WorkspaceSummary[]>();
  for (const { workspace, repository } of entries) {
    if (!repository) continue;
    const workspaces = byRepository.get(repository);
    if (workspaces) workspaces.push(workspace);
    else byRepository.set(repository, [workspace]);
  }
  return byRepository;
}

/** The repositories whose name holds every word of `filter` (all of them for a blank one), in their order. */
export function matchingRepositories(repositories: readonly RepositorySummary[], filter: string): RepositorySummary[] {
  return filter.trim() ? repositories.filter((repository) => matchesAllWords(repository.name, filter)) : [...repositories];
}

/** The rows the repositories show: each one, and under each expanded one its workspaces and "New workspace". */
export function repositoryListRows(
  repositories: readonly RepositorySummary[],
  workspaces: ReadonlyMap<string, WorkspaceSummary[]>,
  expanded: ReadonlySet<string>,
): RepositoryListRow[] {
  const rows: RepositoryListRow[] = [];
  for (const repository of repositories) {
    const own = workspaces.get(repository.spec) ?? NO_WORKSPACES;
    const isExpanded = expanded.has(repository.spec);
    rows.push({ kind: 'repository', repository, workspaces: own, expanded: isExpanded });
    if (!isExpanded) continue;
    for (const workspace of own) rows.push({ kind: 'workspace', repository, workspace });
    rows.push({ kind: 'newWorkspace', repository });
  }
  return rows;
}

/** A row's identity across filtering and expanding, so React and the list's measures keep it. */
export function repositoryRowKey(row: RepositoryListRow): string {
  if (row.kind === 'workspace') return `workspace:${row.repository.spec}:${row.workspace.guid}`;
  return `${row.kind}:${row.repository.spec}`;
}

/** Where a key moves the focus in the list: to a row's index, back up out of the list, or nowhere (null). */
export type RowKeyTarget = number | 'leaveTop' | null;

/**
 * ↑/↓, Page Up / Down, Home and End move between the repositories and workspaces ("New workspace" is reached with Tab,
 * as before); ↑ on the first row leaves the list for what leads into it (the search field).
 */
export function repositoryRowKeyTarget(rows: readonly RepositoryListRow[], current: number, key: string): RowKeyTarget {
  const stops = rows.flatMap((row, index) => (row.kind === 'newWorkspace' ? [] : [index]));
  const at = stops.indexOf(current);
  if (at === -1) return null;
  if (key === 'ArrowUp' && at === 0) return 'leaveTop';
  const ends: Record<string, number> = { Home: 0, End: stops.length - 1 };
  const target = ends[key] ?? navigationTarget(key, at, stops.length);
  return target === null ? null : stops[target]!;
}
