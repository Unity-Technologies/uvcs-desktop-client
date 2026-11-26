import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { DiffEntry, DiffTarget } from '@shared/domain/diff';
import { parseBranchGuid } from '@shared/domain/stableIds';
import { api } from '../../../api/client';
import { SLOW_CHANGING_QUERY } from '../../../app/queryClient';
import { useRepositoryGuid } from '../../../app/workspace/repositoryGuid';
import { usePlace, usePlaceRepository } from '../../../app/workspace/useWorkspace';
import { branchQuery } from '../../branches/useBranches';
import { useReviewModeOn } from '../../review/reviewModeSetting';
import { useReviewMode, type ReviewMode } from '../../review/useReviewMode';
import { diffReviewName, diffReviewReads, diffReviewStatusOf, formerDiffReviewName, type DiffReviewMarks } from './diffReview';
import { diffReviewMarksKey, reviewTargetWhenKnown, setDiffReviewed, type DiffReviewTarget } from './diffReviewOperations';

const NO_MARKS: DiffReviewMarks = new Map();

interface DiffReview extends ReviewMode<DiffEntry> {
  /** The revisions reviewed, to show what changed since: none outside review mode. */
  marks: DiffReviewMarks;
}

/**
 * Review mode on the files of a committed diff: marks kept per repository (its GUID), by the diff's name and the
 * revision reviewed. A branch's diff is named by the branch's GUID. Both GUIDs are read only in review mode, where the
 * marks show (`diffReviewReads`; a branch's is one light `cm find`, shared with every view of the branch). `enabled` false reads no marks yet (a details panel
 * whose changed files aren't asked for).
 */
export function useDiffReview(target: DiffTarget, entries: DiffEntry[], enabled = true): DiffReview {
  const place = usePlace();
  const repositorySpec = usePlaceRepository();
  const reviewModeOn = useReviewModeOn(place);
  const reads = diffReviewReads({ enabled, reviewModeOn, target });
  const repository = useRepositoryGuid(repositorySpec, { read: reads.repository });
  const branch = useQuery({
    ...branchQuery(place, target.kind === 'branch' ? target.branch : ''),
    enabled: reads.branch,
    ...SLOW_CHANGING_QUERY,
  }).data;
  const name = diffReviewName(target, branch ? parseBranchGuid(branch.guid) : undefined);
  const known: DiffReviewTarget | undefined = repository && name ? { place, repository, name, formerName: formerDiffReviewName(target) } : undefined;
  const { data } = useQuery({
    queryKey: diffReviewMarksKey({ place, repository, name }),
    queryFn: () => api.review.diffMarks(known!.repository, known!.name, known!.formerName),
    enabled: enabled && known !== undefined,
    staleTime: Infinity,
  });
  const marks = useMemo<DiffReviewMarks>(() => new Map((data ?? []).map((mark) => [mark.path, mark.revisionId])), [data]);
  const statusOf = useMemo(() => diffReviewStatusOf(marks), [marks]);
  const review = useReviewMode({
    place,
    items: entries,
    statusOf,
    setReviewed: (files, reviewed) => {
      const targetToWrite = reviewTargetWhenKnown(known, place, repositorySpec, target);
      if (targetToWrite) void setDiffReviewed(targetToWrite, files, reviewed);
    },
  });
  return { ...review, marks: review.on ? marks : NO_MARKS };
}
