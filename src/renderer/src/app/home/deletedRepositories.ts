import type { RepositorySummary } from '@shared/domain/repository';
import { isRepositoryNameTaken } from './workspaceNaming';

/**
 * The repositories a server's list shows: its live ones, and with `withDeleted` its deleted ones among them, each in
 * its place by name; a live one comes before a deleted one of the same name, the one people open.
 */
export function repositoriesShown(live: readonly RepositorySummary[], deleted: readonly RepositorySummary[], withDeleted: boolean): RepositorySummary[] {
  if (!withDeleted || deleted.length === 0) return [...live];
  return [...live, ...deleted].sort((a, b) => a.name.localeCompare(b.name) || Number(a.deleted ?? false) - Number(b.deleted ?? false));
}

/**
 * Whether a deleted repository needs a new name to be restored: `cm` refuses to restore one under the name a live
 * repository took since.
 */
export function restoreNeedsNewName(deleted: RepositorySummary, liveNames: readonly string[]): boolean {
  return isRepositoryNameTaken(deleted.name, liveNames);
}
