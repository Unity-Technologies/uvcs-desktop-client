import type { DirectoryConflictResolution, MergeChange } from '@shared/domain/merge';
import type { MergeLabels } from './mergeDescription';
import type { MergeItem } from './mergeItems';
import type { FileConflictState } from './resolve/useFileConflicts';

/**
 * Where a conflict stands in the preview. Worded as what the merge will do, never as done: nothing is written until
 * the user completes the merge.
 */
export type ConflictStatus =
  | 'reading'
  | 'unreadable'
  /** Both sides changed it, in different places: combined without the user. */
  | 'automatic'
  | 'needsDecision'
  | 'keepingDestination'
  | 'keepingSource'
  /** A directory conflict keeping both items, the destination one renamed. */
  | 'keepingBoth'
  /** Merged text that takes something from each side, as the user picked. */
  | 'combined'
  | 'edited'
  /** Saved in a merge tool. */
  | 'resolvedInTool'
  /** A merge tool has the file open, waiting for the user to save and close it. */
  | 'openInTool';

/** How a status reads: `pending` waits for the user, `automatic` needs nothing, `decided` follows the user's choice. */
export type StatusTone = 'muted' | 'pending' | 'automatic' | 'decided';

export interface StatusPresentation {
  label: string;
  tone: StatusTone;
  /** What the status means, for its tooltip. */
  explanation: string;
}

export function fileConflictStatus(state: FileConflictState): ConflictStatus {
  if (state.status === 'loading') return 'reading';
  if (state.status === 'error') return 'unreadable';
  if (state.openTool) return 'openInTool';
  if (state.mergedAutomatically) return 'automatic';

  const { resolution, decision, contents } = state;
  if (!resolution) return 'needsDecision';
  if (decision?.tool) return 'resolvedInTool';
  if (resolution.choice === 'destination') return 'keepingDestination';
  if (resolution.choice === 'source') return 'keepingSource';
  if (decision?.kind === 'text' && decision.edited) return 'edited';
  if (resolution.text === contents?.destination.text) return 'keepingDestination';
  if (resolution.text === contents?.source.text) return 'keepingSource';
  return 'combined';
}

/** The status of a conflict in the list; changes that apply cleanly have none. */
export function conflictStatusOf(item: MergeItem): ConflictStatus | null {
  switch (item.kind) {
    case 'fileConflict':
      return fileConflictStatus(item.state);
    case 'directoryConflict':
      return directoryConflictStatus(item.resolution);
    case 'change':
      return null;
  }
}

export function directoryConflictStatus(resolution: DirectoryConflictResolution | undefined): ConflictStatus {
  switch (resolution?.choice) {
    case undefined:
      return 'needsDecision';
    case 'source':
      return 'keepingSource';
    case 'destination':
      return 'keepingDestination';
    case 'rename':
      return 'keepingBoth';
  }
}

/** The merge tool a file's status speaks of: the one it's open in, or the one that resolved it. */
export function fileConflictTool(state: FileConflictState): string | undefined {
  return state.openTool?.toolName ?? state.decision?.tool;
}

/** `tool`: the merge tool of `openInTool` and `resolvedInTool`. */
export function presentStatus(status: ConflictStatus, labels: MergeLabels, tool = 'the merge tool'): StatusPresentation {
  const { source, destination } = labels.roles;
  switch (status) {
    case 'reading':
      return { label: 'Reading…', tone: 'muted', explanation: 'Reading the base, incoming and destination versions of this file.' };
    case 'unreadable':
      return { label: "Can't read", tone: 'pending', explanation: "Couldn't read the versions of this file to merge them." };
    case 'automatic':
      return {
        label: 'Will merge automatically',
        tone: 'automatic',
        explanation: `Both sides changed this file, in different places, so their changes combine without asking you. To override, keep ${destination.version} or ${source.version} from the file's menu. Nothing is written until you complete the merge.`,
      };
    case 'needsDecision':
      return {
        label: 'Needs your decision',
        tone: 'pending',
        explanation: `Both sides changed the same lines. Resolve it in a merge tool, or pick a side for each conflict or for the whole file: keep ${destination.version}, keep ${source.version} or keep both.`,
      };
    case 'keepingDestination':
      return { label: `Keeping ${destination.name.toLowerCase()}`, tone: 'decided', explanation: `The result will be ${destination.version} (${labels.destination}), as you chose.` };
    case 'keepingSource':
      return { label: `Keeping ${source.name.toLowerCase()}`, tone: 'decided', explanation: `The result will be ${source.version} (${labels.source}), as you chose.` };
    case 'keepingBoth':
      return { label: 'Keeping both', tone: 'decided', explanation: `Both items stay; the one from ${labels.destination} gets a new name.` };
    case 'combined':
      return { label: 'Combined', tone: 'decided', explanation: 'The result takes lines from both sides, as you chose for its conflicts.' };
    case 'edited':
      return { label: 'Edited by you', tone: 'decided', explanation: 'You resolved the conflicts by hand. The file will be written as you left it.' };
    case 'resolvedInTool':
      return { label: `Resolved in ${tool}`, tone: 'decided', explanation: `You resolved it in ${tool}. The file will be written as you saved it there when you complete the merge.` };
    case 'openInTool':
      return { label: `Open in ${tool}…`, tone: 'pending', explanation: `Waiting for you to save the result in ${tool} and close it.` };
  }
}

/** A change that applies cleanly, in future words: "Will be added", with why (only one side touched it). */
export function describeChange(change: MergeChange, labels: MergeLabels): string {
  const source = labels.roles.source.name.toLowerCase();
  switch (change.kind) {
    case 'added':
      return `Will be added: new on the ${source} side`;
    case 'changed':
      return `Will be changed: only the ${source} side changed it`;
    case 'deleted':
      return `Will be deleted: deleted on the ${source} side`;
    case 'moved':
      return change.oldPath ? `Will be moved from ${change.oldPath}` : 'Will be moved';
    case 'permissions':
      return 'Its file permissions will change';
  }
}

/** "598 changes to apply · 2 conflicts: 1 will merge automatically, 1 needs your decision". */
export function summarizePlan(changeCount: number, statuses: ConflictStatus[]): string {
  const changes = `${changeCount} ${changeCount === 1 ? 'change' : 'changes'} to apply`;
  if (statuses.length === 0) return `${changes} · no conflicts`;

  const count = (wanted: (status: ConflictStatus) => boolean): number => statuses.filter(wanted).length;
  const automatic = count((status) => status === 'automatic');
  const waiting = count((status) => status === 'needsDecision' || status === 'unreadable' || status === 'reading' || status === 'openInTool');
  const decided = statuses.length - automatic - waiting;
  const parts = [
    automatic > 0 && `${automatic} will merge automatically`,
    decided > 0 && `${decided} decided`,
    waiting > 0 && `${waiting} ${waiting === 1 ? 'needs' : 'need'} your decision`,
  ].filter(Boolean);
  return `${changes} · ${statuses.length} ${statuses.length === 1 ? 'conflict' : 'conflicts'}: ${parts.join(', ')}`;
}
