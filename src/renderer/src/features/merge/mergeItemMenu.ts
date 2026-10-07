import type { ContentSource, RepositoryVersion } from '@shared/domain/content';
import { mergeSourcePoint, RENAMEABLE_CONFLICTS, type DirectoryConflictResolution, type MergePlan, type MergeRequest } from '@shared/domain/merge';
import type { MergeTool } from '@shared/domain/mergeTools';
import type { ItemType } from '@shared/domain/pendingChanges';
import type { PageOf } from '../../app/navigation/pages';
import { changedFileMenu, type ChangedFile } from '../../components/changedFileMenu';
import { openFile } from '../../components/externalApps/externalAppOperations';
import { menuAction, menuSubmenu } from '../../components/menuWords';
import type { Action, MenuEntry } from '../../lib/actions';
import type { GroupedEntry } from '../../lib/menuGroups';
import { fileNameOf } from '../../lib/text';
import { annotatedHistory } from '../history/annotatedHistory';
import { openVersion } from '../history/revisionOperations';
import { absolutePath } from '../pendingChanges/pendingChangeOperations';
import { suggestRename } from './directoryConflicts/renameSuggestion';
import type { MergeLabels } from './mergeDescription';
import type { MergeItem } from './mergeItems';
import type { FileConflictDecision } from './resolve/fileConflictDecision';
import { keepVersionEntries } from './resolve/keepVersionEntries';
import type { FileConflictState } from './resolve/useFileConflicts';

/** What the merge page knows and can do, for the menu of what it lists. */
export interface MergeMenuContext {
  workspacePath: string;
  request: MergeRequest;
  plan: MergePlan;
  labels: MergeLabels;
  /** What a repository path of the merge is (`mergeItemTypes`): a folder has nothing to open. */
  itemTypeOf: (path: string) => ItemType;
  /** The tool "Resolve in…" opens; none when no merge tool was found. */
  preferredTool: MergeTool | undefined;
  /** Files resolve one by one in a tool: no other opens meanwhile. */
  running: boolean;
  decide: (key: string, decision: FileConflictDecision) => void;
  reset: (key: string) => void;
  resolveIn: (key: string, tool: MergeTool) => void;
  resolveDirectory: (index: number, resolution: DirectoryConflictResolution) => void;
}

/**
 * The menu of what the merge page lists: the menu of any list of changed files (`changedFileMenu`: history, annotate,
 * open or save the incoming version, Copy), with what a merge adds on top. A conflicting file: "Resolve in <tool>", Keep
 * yours or incoming, Start over once decided, and each side's version or the base to open. A directory conflict: its
 * panel's choices. Several selected: the conflicting files settled at once. Nothing is read to build it.
 */
export function mergeItemMenu(items: MergeItem[], context: MergeMenuContext): MenuEntry[] {
  const single = items.length === 1 ? items[0]! : null;
  const conflictKeys = items.flatMap((item) => (item.kind === 'fileConflict' ? [item.state.file.key] : []));
  const added: (GroupedEntry | null)[] = [
    ...(single?.kind === 'fileConflict' ? fileConflictEntries(single.state, context) : []),
    ...keepVersionEntries(conflictKeys, context.labels, context.decide),
    ...(single?.kind === 'fileConflict' && single.state.decidedByUser ? [menuAction('startOver', () => context.reset(single.state.file.key))] : []),
    ...(single?.kind === 'directoryConflict' ? directoryConflictEntries(single, context) : []),
  ];
  const files = items.map((item) => changedFileOf(item, context));
  return changedFileMenu(context.workspacePath, single ? files : files.map((file) => ({ ...file, history: null, annotation: null, version: null })), added);
}

/** "Resolve in <tool>" (a text file, a tool found) and "Open version ▸" with each side's version and the base. */
function fileConflictEntries(state: FileConflictState, context: MergeMenuContext): GroupedEntry[] {
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
function versionEntries(state: FileConflictState, { workspacePath, request, labels }: MergeMenuContext): Action[] {
  const fileName = fileNameOf(state.file.path);
  const open = (version: ContentSource) => (version.kind === 'empty' ? undefined : () => void openVersion(workspacePath, version as RepositoryVersion, fileName));
  const yours = request.destinationBranch ? open(state.file.destination) : () => void openFile(absolutePath(workspacePath, state.file.path));
  const base = open(state.file.base);
  return [
    { id: 'openVersion.destination', label: labels.roles.destination.name, run: yours! },
    { id: 'openVersion.source', label: labels.roles.source.name, run: open(state.file.source)! },
    ...(base ? [{ id: 'openVersion.base', label: 'Base', run: base }] : []),
  ];
}

/** Keep yours, keep incoming, and keep both (yours under the name its panel suggests) where both can stay. */
function directoryConflictEntries(item: Extract<MergeItem, { kind: 'directoryConflict' }>, { labels, resolveDirectory }: MergeMenuContext): GroupedEntry[] {
  const { conflict, index } = item;
  const keep = (resolution: DirectoryConflictResolution) => () => resolveDirectory(index, resolution);
  return [
    menuAction('keepDestination', keep({ choice: 'destination' }), { label: `Keep ${labels.roles.destination.name.toLowerCase()}` }),
    menuAction('keepSource', keep({ choice: 'source' }), { label: `Keep ${labels.roles.source.name.toLowerCase()}` }),
    ...(RENAMEABLE_CONFLICTS.has(conflict.type) ? [menuAction('keepBoth', keep({ choice: 'rename', newName: suggestRename(conflict.destination.path, labels.destination) }))] : []),
  ];
}

/**
 * An item as the shared menu needs it. The incoming version is what Open and Save as read, as a diff's newer side: a
 * conflicting file's source version, or a clean change's path at the source changeset (none for a delete, a folder or
 * a directory conflict). Annotate shows a conflicting file's incoming revision in its history, by the changeset `cm`
 * names for it; a clean change has none named (only the merge's own changesets, where the file may not have changed),
 * so it isn't offered there rather than annotating another revision.
 */
function changedFileOf(item: MergeItem, { request, plan, itemTypeOf }: MergeMenuContext): ChangedFile {
  const history: PageOf<'history'> = { kind: 'history', path: item.path };
  const annotateAt = (changesetId: number) => annotatedHistory({ path: item.path, select: { changesetId } });
  switch (item.kind) {
    case 'fileConflict': {
      const { source } = item.state.file;
      const incomingChangeset = plan.fileConflicts.find((conflict) => conflict.path === item.state.file.key)?.sourceChangeset;
      return {
        path: item.path,
        history,
        annotation: incomingChangeset === undefined || item.state.isBinary ? null : annotateAt(incomingChangeset),
        version: source.kind === 'empty' ? null : (source as RepositoryVersion),
      };
    }
    case 'directoryConflict':
      return { path: item.path, history, annotation: null, version: null };
    case 'change': {
      const sourceChangeset = sourceChangesetOf(plan);
      const readable = itemTypeOf(item.change.path) !== 'directory' && item.change.kind !== 'deleted' && sourceChangeset !== undefined;
      return {
        path: item.path,
        history,
        annotation: null,
        version: readable ? { kind: 'repositoryPath', path: item.change.path, at: mergeSourcePoint(request, sourceChangeset) } : null,
      };
    }
  }
}

function sourceChangesetOf(plan: MergePlan): number | undefined {
  return plan.contributors?.source.changesetId;
}
