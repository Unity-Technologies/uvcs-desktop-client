import type { ContentSource, RepositoryVersion } from '@shared/domain/content';
import type { MergeTool } from '@shared/domain/mergeTools';
import { openFile } from '../../../components/externalApps/externalAppOperations';
import { menuAction, menuSubmenu } from '../../../components/menuWords';
import type { Action } from '../../../lib/actions';
import type { GroupedEntry } from '../../../lib/menuGroups';
import { fileNameOf } from '../../../lib/text';
import { openVersion } from '../../history/revisionOperations';
import { absolutePath } from '../../pendingChanges/pendingChangeOperations';
import type { MergeLabels } from '../mergeDescription';
import type { FileConflictDecision } from './fileConflictDecision';
import { keepVersionEntries } from './keepVersionEntries';
import type { FileConflictState } from './useFileConflicts';

/** What the menu of conflicting files needs, wherever they are resolved: the merge page and Incoming. */
export interface ConflictMenuContext {
  workspacePath: string;
  labels: MergeLabels;
  /** "Yours" is the workspace file (a merge into the workspace, an update), not the destination's version on the server. */
  yoursInWorkspace: boolean;
  /** The tool "Resolve in…" opens; none when no merge tool was found. */
  preferredTool: MergeTool | undefined;
  /** Files resolve one by one in a tool: no other opens meanwhile. */
  running: boolean;
  decide: (key: string, decision: FileConflictDecision) => void;
  reset: (key: string) => void;
  resolveIn: (key: string, tool: MergeTool) => void;
}

/**
 * What the conflicting files selected add to the menu of a list of changed files, the same on the merge page and in
 * Incoming: one of them, "Resolve in <tool>" and "Open version ▸" with each side's version and the base; any, Keep
 * yours or incoming (`keepVersionEntries`); one the user decided, Start over. Nothing is read to build it.
 */
export function conflictMenuEntries(selected: FileConflictState[], context: ConflictMenuContext): GroupedEntry[] {
  const single = selected.length === 1 ? selected[0]! : null;
  return [
    ...(single ? singleConflictEntries(single, context) : []),
    ...keepVersionEntries(
      selected.map((state) => state.file.key),
      context.labels,
      context.decide,
    ),
    ...(single?.decidedByUser ? [menuAction('startOver', () => context.reset(single.file.key))] : []),
  ];
}

/** "Resolve in <tool>" (a text file, a tool found) and "Open version ▸" with each side's version and the base. */
function singleConflictEntries(state: FileConflictState, context: ConflictMenuContext): GroupedEntry[] {
  const { preferredTool: tool } = context;
  const resolveIn =
    tool && !state.isBinary && !state.openTool
      ? [
          menuAction('resolveIn', () => context.resolveIn(state.file.key, tool), {
            label: `Resolve in ${tool.name}`,
            disabled: context.running,
            disabledReason: context.running ? 'Files are resolving one by one' : undefined,
          }),
        ]
      : [];
  return [...resolveIn, menuSubmenu('openVersion', versionEntries(state, context))];
}

/** Yours (the workspace file, or the destination's version merging into a server branch), Incoming, and Base. */
function versionEntries(state: FileConflictState, { workspacePath, labels, yoursInWorkspace }: ConflictMenuContext): Action[] {
  const fileName = fileNameOf(state.file.path);
  const open = (version: ContentSource) => (version.kind === 'empty' ? undefined : () => void openVersion(workspacePath, version as RepositoryVersion, fileName));
  const yours = yoursInWorkspace ? () => void openFile(absolutePath(workspacePath, state.file.path)) : open(state.file.destination);
  const base = open(state.file.base);
  return [
    { id: 'openVersion.destination', label: labels.roles.destination.name, run: yours! },
    { id: 'openVersion.source', label: labels.roles.source.name, run: open(state.file.source)! },
    ...(base ? [{ id: 'openVersion.base', label: 'Base', run: base }] : []),
  ];
}
