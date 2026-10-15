import type { RepositoryVersion } from '@shared/domain/content';
import { mergeSourcePoint, RENAMEABLE_CONFLICTS, type DirectoryConflictResolution, type MergePlan, type MergeRequest } from '@shared/domain/merge';
import type { ItemType } from '@shared/domain/pendingChanges';
import type { PageOf } from '../../app/navigation/pages';
import { changedFileMenu, type ChangedFile } from '../../components/changedFileMenu';
import { menuAction } from '../../components/menuWords';
import type { MenuEntry } from '../../lib/actions';
import type { GroupedEntry } from '../../lib/menuGroups';
import { annotatedHistory } from '../history/annotatedHistory';
import { suggestRename } from './directoryConflicts/renameSuggestion';
import { fileStateOf, type MergeItem, type MergeProgress } from './mergeItems';
import { conflictMenuEntries, type ConflictMenuContext } from './resolve/conflictMenuEntries';

/** What the merge page knows and can do, for the menu of what it lists. */
export interface MergeMenuContext extends Omit<ConflictMenuContext, 'yoursInWorkspace'> {
  request: MergeRequest;
  plan: MergePlan;
  progress: MergeProgress;
  /** What a repository path of the merge is (`mergeItemTypes`): a folder has nothing to open. */
  itemTypeOf: (path: string) => ItemType;
  resolveDirectory: (index: number, resolution: DirectoryConflictResolution) => void;
}

/**
 * The menu of what the merge page lists: the menu of any list of changed files (`changedFileMenu`: history, annotate,
 * open or save the incoming version, Copy), with what a merge adds on top: the conflicting files' entries, the same
 * as Incoming's (`conflictMenuEntries`), and a directory conflict's panel choices. Nothing is read to build it.
 */
export function mergeItemMenu(items: MergeItem[], context: MergeMenuContext): MenuEntry[] {
  const single = items.length === 1 ? items[0]! : null;
  const conflicts = items.flatMap((item) => (item.kind === 'fileConflict' ? [fileStateOf(item, context.progress)] : []));
  const added: GroupedEntry[] = [
    ...conflictMenuEntries(conflicts, { ...context, yoursInWorkspace: !context.request.destinationBranch }),
    ...(single?.kind === 'directoryConflict' ? directoryConflictEntries(single, context) : []),
  ];
  const files = items.map((item) => changedFileOf(item, context));
  return changedFileMenu(context.workspacePath, single ? files : files.map((file) => ({ ...file, history: null, annotation: null, version: null })), added);
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
function changedFileOf(item: MergeItem, { request, plan, progress, itemTypeOf }: MergeMenuContext): ChangedFile {
  const history: PageOf<'history'> = { kind: 'history', path: item.path };
  const annotateAt = (changesetId: number) => annotatedHistory({ path: item.path, select: { changesetId } });
  switch (item.kind) {
    case 'fileConflict': {
      const { source } = item.file;
      const incomingChangeset = plan.fileConflicts.find((conflict) => conflict.path === item.file.key)?.sourceChangeset;
      return {
        path: item.path,
        history,
        annotation: incomingChangeset === undefined || fileStateOf(item, progress).isBinary ? null : annotateAt(incomingChangeset),
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
