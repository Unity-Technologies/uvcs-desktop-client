import type { DiffEntry } from '@shared/domain/diff';
import type { DiffReviewMark } from '@shared/domain/review';
import { api } from '../../../api/client';
import { queryKeys } from '../../../api/queryKeys';
import { queryClient } from '../../../app/queryClient';
import { toast } from '../../../ui/toast/toastStore';

/** Identifies the marks of one diff: the repository it belongs to and the diff's name there. */
export interface DiffReviewTarget {
  workspacePath: string;
  repository: string;
  name: string;
}

export function diffReviewMarksKey({ workspacePath, repository, name }: DiffReviewTarget) {
  return queryKeys.inWorkspace(workspacePath, 'diffReview', repository, name);
}

/** Marks the files reviewed at the revision the diff shows, or clears their marks. The list shows it right away; the store confirms it. */
export async function setDiffReviewed(target: DiffReviewTarget, entries: DiffEntry[], reviewed: boolean): Promise<void> {
  if (entries.length === 0) return;
  const key = diffReviewMarksKey(target);
  const paths = new Set(entries.map((entry) => entry.path));
  const marks = entries.map((entry): DiffReviewMark => ({ path: entry.path, revisionId: entry.revisionId }));
  await queryClient.cancelQueries({ queryKey: key });
  queryClient.setQueryData<DiffReviewMark[]>(key, (current = []) => [...current.filter((mark) => !paths.has(mark.path)), ...(reviewed ? marks : [])]);
  try {
    await (reviewed ? api.review.markDiff(target.repository, target.name, marks) : api.review.unmarkDiff(target.repository, target.name, [...paths]));
  } catch (error) {
    toast.error(reviewed ? "Couldn't mark the files as reviewed" : "Couldn't clear the review marks", error);
  }
  await queryClient.invalidateQueries({ queryKey: key });
}
