import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { DiffEntry, DiffTarget } from '@shared/domain/diff';
import { api } from '../../../api/client';
import { useWorkspaceInfo, useWorkspacePath } from '../../../app/workspace/useWorkspace';
import { useReviewMode, type ReviewMode } from '../../review/useReviewMode';
import { diffReviewName, diffReviewStatusOf, type DiffReviewMarks } from './diffReview';
import { diffReviewMarksKey, setDiffReviewed, type DiffReviewTarget } from './diffReviewOperations';

const NO_MARKS: DiffReviewMarks = new Map();

interface DiffReview extends ReviewMode<DiffEntry> {
  /** The revisions reviewed, to show what changed since: none outside review mode. */
  marks: DiffReviewMarks;
}

/** Review mode on the files of a committed diff: marks kept per repository, by the diff's name and the revision reviewed. */
export function useDiffReview(target: DiffTarget, entries: DiffEntry[]): DiffReview {
  const workspacePath = useWorkspacePath();
  const repository = useWorkspaceInfo().data?.repository ?? '';
  const reviewTarget: DiffReviewTarget = { workspacePath, repository, name: diffReviewName(target) };
  const { data } = useQuery({
    queryKey: diffReviewMarksKey(reviewTarget),
    queryFn: () => api.review.diffMarks(repository, reviewTarget.name),
    enabled: repository !== '',
    staleTime: Infinity,
  });
  const marks = useMemo<DiffReviewMarks>(() => new Map((data ?? []).map((mark) => [mark.path, mark.revisionId])), [data]);
  const statusOf = useMemo(() => diffReviewStatusOf(marks), [marks]);
  const review = useReviewMode({
    workspacePath,
    items: entries,
    statusOf,
    setReviewed: (files, reviewed) => void setDiffReviewed(reviewTarget, files, reviewed),
  });
  return { ...review, marks: review.on ? marks : NO_MARKS };
}
