import type { RepositorySummary } from '@shared/domain/repository';
import type { WorkspaceSummary } from '@shared/domain/workspace';

/** The action a repository's row offers beside its menu (`RepositoryRow` only shows it). */
export type RepositoryRowAction =
  | { kind: 'restore' }
  | { kind: 'open'; workspace: WorkspaceSummary }
  /** Explore it or create a workspace: it has none yet. */
  | { kind: 'create' }
  /** Its several workspaces show under it, each with its own Open. */
  | { kind: 'none' };

export function repositoryRowActionOf(repository: RepositorySummary, workspaces: readonly WorkspaceSummary[]): RepositoryRowAction {
  if (repository.deleted) return { kind: 'restore' };
  if (workspaces.length === 1) return { kind: 'open', workspace: workspaces[0] };
  if (workspaces.length === 0) return { kind: 'create' };
  return { kind: 'none' };
}
