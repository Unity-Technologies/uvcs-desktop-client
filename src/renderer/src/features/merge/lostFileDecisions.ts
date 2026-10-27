import type { MergePlan } from '@shared/domain/merge';
import { fileNameOf, pluralize } from '../../lib/text';
import { toast } from '../../ui/toast/toastStore';
import { fileConflictKey } from './conflictedFiles';
import type { FileConflictState } from './resolve/useFileConflicts';

/**
 * After a directory decision: the conflicting files the user had decided that the merge no longer holds (a folder
 * deleted, one item of a folder added on both sides kept) start over, so that a later decision bringing one back
 * brings it undecided, and a toast names them. A file the decision only moved keeps its decision (`fileConflictKey`).
 */
export function forgetLostFileDecisions(before: MergePlan, after: MergePlan, states: readonly FileConflictState[], reset: (key: string) => void): void {
  const left = new Set(after.fileConflicts.map(fileConflictKey));
  const wasInMerge = new Set(before.fileConflicts.map(fileConflictKey));
  const lost = states.filter((state) => state.decidedByUser && wasInMerge.has(state.file.key) && !left.has(state.file.key));
  if (lost.length === 0) return;

  lost.forEach((state) => reset(state.file.key));
  if (lost.length === 1) toast.info(`Your decision on ${fileNameOf(lost[0]!.file.path)} no longer applies`, 'A directory decision took the file out of the merge.');
  else toast.info(`Your decisions on ${pluralize(lost.length, 'file')} no longer apply`, 'A directory decision took them out of the merge.');
}
