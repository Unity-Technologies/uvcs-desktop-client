import type { DiffEntry } from '@shared/domain/diff';
import type { MenuEntry } from '../../lib/actions';
import { diffEntryMenu } from '../diff/diffEntryMenu';
import { keepVersionEntries } from '../merge/resolve/keepVersionEntries';
import type { FileConflictDecision } from '../merge/resolve/fileConflictDecision';
import type { FileConflictState } from '../merge/resolve/useFileConflicts';
import { incomingDiffTarget, type IncomingScope } from './incomingScope';
import { UPDATE_LABELS } from './updateConflictFiles';

/** What Incoming knows and can do, for the menu of the files it lists. */
export interface IncomingFileMenuContext {
  workspacePath: string;
  scope: IncomingScope;
  loadedChangeset: number;
  headChangeset: number;
  /** The conflict of a path changed on both sides, by its path; none for the others. */
  conflictOf: (path: string) => FileConflictState | undefined;
  decide: (key: string, decision: FileConflictDecision) => void;
}

/**
 * The menu of Incoming's files: a diff's (`diffEntryMenu`), read from the scope's diff. In "All incoming changes" the
 * conflicts selected add what settles them; a changeset's files are what it did, so they add nothing.
 */
export function incomingFileMenu(selected: DiffEntry[], context: IncomingFileMenuContext): MenuEntry[] {
  const { workspacePath, scope, loadedChangeset, headChangeset } = context;
  const conflicts = scope.kind === 'all' ? selected.flatMap((file) => context.conflictOf(file.path) ?? []) : [];
  const target = incomingDiffTarget(scope, loadedChangeset, headChangeset);
  return diffEntryMenu(
    workspacePath,
    target,
    selected,
    undefined,
    keepVersionEntries(
      conflicts.map((state) => state.file.key),
      UPDATE_LABELS,
      context.decide,
    ),
  );
}
