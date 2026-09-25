import type { ReviewMark } from '@shared/domain/review';
import { api } from '../../../api/client';
import { queryClient } from '../../../app/queryClient';
import { toast } from '../../../ui/toast/toastStore';
import { reviewMarksKey } from './useReviewMarks';

/** Marks the files as reviewed, or clears their marks. The list shows it right away; the store confirms it. */
export async function setReviewed(workspacePath: string, paths: string[], reviewed: boolean): Promise<void> {
  if (paths.length === 0) return;
  const key = reviewMarksKey(workspacePath);
  await queryClient.cancelQueries({ queryKey: key });
  queryClient.setQueryData<ReviewMark[]>(key, (current = []) => {
    const others = current.filter((mark) => !paths.includes(mark.path));
    if (!reviewed) return others;
    const before = new Map(current.map((mark) => [mark.path, mark]));
    return [...others, ...paths.map((path): ReviewMark => ({ path, state: 'reviewed', hasSnapshot: before.get(path)?.hasSnapshot ?? false }))];
  });
  try {
    await (reviewed ? api.review.mark(workspacePath, paths) : api.review.unmark(workspacePath, paths));
  } catch (error) {
    toast.error(reviewed ? "Couldn't mark the files as reviewed" : "Couldn't clear the review marks", error);
  }
  await queryClient.invalidateQueries({ queryKey: key });
}
