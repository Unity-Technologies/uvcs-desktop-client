import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { api } from '../../../api/client';
import { queryKeys } from '../../../api/queryKeys';
import { queryClient } from '../../../app/queryClient';
import type { ReviewMarks } from './pendingReviewStatus';

export function reviewMarksKey(workspacePath: string) {
  return queryKeys.inWorkspace(workspacePath, 'review');
}

/**
 * The review marks of the workspace, by path. Marks of files that left the pending changes (checked in, undone...)
 * are dropped along with their reviewed copies, once `changes` is the settled list rather than a placeholder.
 */
export function useReviewMarks(workspacePath: string, changes: PendingChange[] | undefined, settled: boolean): ReviewMarks {
  const { data } = useQuery({
    queryKey: reviewMarksKey(workspacePath),
    queryFn: () => api.review.marks(workspacePath),
    placeholderData: (previous) => previous,
  });
  const marks = useMemo(() => new Map((data ?? []).map((mark) => [mark.path, mark])), [data]);

  useEffect(() => {
    if (!changes || !settled) return;
    const pending = new Set(changes.map((change) => change.path));
    if (![...marks.keys()].some((path) => !pending.has(path))) return;
    void api.review
      .keepOnly(workspacePath, [...pending])
      .then(() => queryClient.invalidateQueries({ queryKey: reviewMarksKey(workspacePath) }));
  }, [workspacePath, changes, settled, marks]);

  return marks;
}
