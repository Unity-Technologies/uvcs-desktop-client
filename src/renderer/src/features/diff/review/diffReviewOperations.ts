import type { Place } from '@shared/domain/place';
import type { DiffEntry, DiffTarget } from '@shared/domain/diff';
import type { DiffReviewMark } from '@shared/domain/review';
import { parseBranchGuid, type RepositoryGuid } from '@shared/domain/stableIds';
import { api } from '../../../api/client';
import { queryKeys } from '../../../api/queryKeys';
import { queryClient } from '../../../app/queryClient';
import { repositoryGuidToWrite } from '../../../app/workspace/repositoryGuidToWrite';
import { toast } from '../../../ui/toast/toastStore';
import { fetchBranch } from '../../branches/useBranches';
import { diffReviewName, formerDiffReviewName } from './diffReview';

/** Identifies the marks of one diff: the repository it belongs to (its GUID) and the diff's name there. */
export interface DiffReviewTarget {
  /** Where the diff shows: its marks are cached with that place's queries. */
  place: Place;
  repository: RepositoryGuid;
  name: string;
  /** The name its marks were kept by before (`formerDiffReviewName`). */
  formerName?: string;
}

/** The marks' query key; a diff whose repository or name isn't known yet reads nothing under it. */
export function diffReviewMarksKey({ place, repository, name }: { place: Place; repository: RepositoryGuid | undefined; name: string | undefined }) {
  return queryKeys.inPlace(place, 'diffReview', repository, name);
}

/**
 * Where the marks of `target`, a diff of `repositorySpec`'s, are written: the repository's GUID and, for a branch's
 * diff, the branch's GUID, each the one read already or read now (a branch's, one light `cm find`). Rejects with a
 * message to show when either can't be read.
 */
export async function diffReviewTargetToWrite(place: Place, repositorySpec: string, target: DiffTarget): Promise<DiffReviewTarget> {
  const repository = await repositoryGuidToWrite(repositorySpec);
  const branchGuid = target.kind === 'branch' ? await branchGuidToWrite(place, target.branch) : undefined;
  return { place, repository, name: diffReviewName(target, branchGuid)!, formerName: formerDiffReviewName(target) };
}

async function branchGuidToWrite(place: Place, name: string) {
  const branch = await fetchBranch(place, name);
  const guid = branch ? parseBranchGuid(branch.guid) : undefined;
  if (!guid) throw new Error(`Couldn't find the branch ${name}.`);
  return guid;
}

/**
 * Marks the files reviewed at the revision the diff shows, or clears their marks. The list shows it right away; the
 * store confirms it. `targetToWrite`: where its marks are written (`diffReviewTargetToWrite`); said when it can't be read.
 */
export async function setDiffReviewed(targetToWrite: () => Promise<DiffReviewTarget>, entries: DiffEntry[], reviewed: boolean): Promise<void> {
  if (entries.length === 0) return;
  const failure = reviewed ? "Couldn't mark the files as reviewed" : "Couldn't clear the review marks";
  let target: DiffReviewTarget;
  try {
    target = await targetToWrite();
  } catch (error) {
    toast.error(failure, error);
    return;
  }
  const key = diffReviewMarksKey(target);
  const paths = new Set(entries.map((entry) => entry.path));
  const marks = entries.map((entry): DiffReviewMark => ({ path: entry.path, revisionId: entry.revisionId }));
  await queryClient.cancelQueries({ queryKey: key });
  queryClient.setQueryData<DiffReviewMark[]>(key, (current = []) => [...current.filter((mark) => !paths.has(mark.path)), ...(reviewed ? marks : [])]);
  try {
    await (reviewed
      ? api.review.markDiff(target.repository, target.name, marks, target.formerName)
      : api.review.unmarkDiff(target.repository, target.name, [...paths], target.formerName));
  } catch (error) {
    toast.error(failure, error);
  }
  await queryClient.invalidateQueries({ queryKey: key });
}
