import type { DiffEntry } from '@shared/domain/diff';
import type { MergeTool } from '@shared/domain/mergeTools';
import type { MenuEntry } from '../../lib/actions';
import { diffEntryMenu } from '../diff/diffEntryMenu';
import { conflictMenuEntries, withConflictOpening } from '../merge/resolve/conflictMenuEntries';
import type { FileConflictDecision } from '../merge/resolve/fileConflictDecision';
import type { ToolForFile } from '../merge/mergeTools/resolveRun';
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
  /** The tool each file opens in (`useMergeToolFor`); none when no merge tool was found. */
  toolFor: ToolForFile;
  /** Every merge tool found, for "Resolve with ▸". */
  tools: MergeTool[];
  /** Files resolve one by one in a tool: no other opens meanwhile. */
  running: boolean;
  decide: (key: string, decision: FileConflictDecision) => void;
  reset: (key: string) => void;
  resolveIn: (key: string, tool: MergeTool) => void;
}

/**
 * The menu of Incoming's files: a diff's (`diffEntryMenu`), read from the scope's diff. In "All incoming changes" the
 * conflicts selected add what settles them, the same as the merge page's (`conflictMenuEntries`: resolve in a tool,
 * each version to open, Keep yours or incoming, Start over); a changeset's files are what it did, so they add nothing.
 */
export function incomingFileMenu(selected: DiffEntry[], context: IncomingFileMenuContext): MenuEntry[] {
  const { workspacePath, scope, loadedChangeset, headChangeset } = context;
  const conflicts = scope.kind === 'all' ? selected.flatMap((file) => context.conflictOf(file.path) ?? []) : [];
  const target = incomingDiffTarget(scope, loadedChangeset, headChangeset);
  const menu = diffEntryMenu(workspacePath, target, selected, {
    added: conflictMenuEntries(conflicts, { ...context, labels: UPDATE_LABELS, yoursInWorkspace: true }),
  });
  return withConflictOpening(menu, conflicts);
}
