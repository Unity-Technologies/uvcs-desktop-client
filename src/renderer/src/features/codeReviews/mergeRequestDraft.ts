import type { Branch } from '@shared/domain/branch';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import type { BranchGroup } from '../branches/branchSearchRows';
import { newestBranchesFirst } from '../branches/newestBranchesFirst';
import { ancestorsOf } from './destinationChoices';
import { isActiveMergeRequest } from './mergeRequestState';

/*
 * What the new merge request dialog decides (`CreateMergeRequestDialog`): its defaults, what stops it, and what the
 * branch already has (docs/features/merge-requests.md "Creating one").
 */

/** A merge request as its dialog holds it: branch names (`/main/task`) and the title typed. */
export interface MergeRequestDraft {
  source: string;
  /** The source's parent branch, once the source is read: a top-level branch that has one may merge into it. */
  sourceParent?: string;
  destination: string;
  title: string;
}

/**
 * Where a branch merges unless the user says otherwise: its top-level ancestor (`/main` for `/main/release/task`), the
 * branch a task usually ends in; for a top-level branch, its parent if it has one. None for a branch with neither.
 */
export function defaultDestinationOf(source: string, parent?: string): string | undefined {
  return ancestorsOf(source).at(-1) ?? (parent || undefined);
}

/**
 * The title a branch's request starts with: its own name (`task-login`), then " - " and its comment's first line when
 * it has one, so a tracker key in either survives. It follows the branch picked until the user edits it.
 */
export function defaultTitleOf(branchName: string, comment: string | undefined): string {
  const name = branchName.slice(branchName.lastIndexOf('/') + 1);
  if (!name) return '';
  const summary = comment?.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  return summary ? `${name} - ${summary}` : name;
}

/**
 * Whether a branch can have a merge request: it has somewhere to merge, an ancestor in its name or a parent. A top-level
 * branch with neither (`/main`) has only code reviews, and no New merge request in its menu.
 */
export function canMergeSomewhere(branch: Pick<Branch, 'name' | 'parent'>): boolean {
  return ancestorsOf(branch.name).length > 0 || Boolean(branch.parent);
}

/** The branches the dialog's From offers, newest first: those that can merge somewhere (`/main` can't). */
export function sourceGroups(branches: readonly Branch[]): BranchGroup[] {
  return [{ title: 'Branches', branches: newestBranchesFirst(branches).filter(canMergeSomewhere) }];
}

/**
 * Why the draft can't be created yet, as the Create button's tooltip says it; none once it can. `cm` checks only that
 * the destination exists: a request from a top-level branch, or into the branch itself, is refused here.
 */
export function draftProblem({ source, sourceParent, destination, title }: MergeRequestDraft): string | undefined {
  if (!source) return 'Pick a branch to merge';
  if (!canMergeSomewhere({ name: source, parent: sourceParent ?? '' })) return 'A top-level branch has no merge request';
  if (!destination) return 'Pick a destination';
  if (source === destination) return "A branch can't merge into itself";
  if (!title.trim()) return 'The title is empty';
  return undefined;
}

/**
 * A request the branch already has into `destination`: one still to merge (`active`: Open or Draft), which a second
 * would only repeat; else the newest merged or closed one (`earlier`), only worth a note. An active one into another
 * destination is no conflict.
 */
export type ExistingRequest = { kind: 'active' | 'earlier'; review: CodeReviewSummary };

export function existingRequestOf(reviewsOfBranch: readonly CodeReviewSummary[], destination: string): ExistingRequest | undefined {
  const intoDestination = reviewsOfBranch.filter((review) => destination !== '' && review.mergeRequest?.destination === destination).sort((a, b) => b.id - a.id);
  const active = intoDestination.find(isActiveMergeRequest);
  if (active) return { kind: 'active', review: active };
  const earlier = intoDestination[0];
  return earlier ? { kind: 'earlier', review: earlier } : undefined;
}

/**
 * What the dialog says of a request the branch already has: `request` names one still to merge, to open, and `blocks`
 * says why Create waits meanwhile (its tooltip). An earlier one is only a note.
 */
export interface ExistingRequestNote {
  text: string;
  request?: string;
  blocks?: string;
}

export function existingRequestNote({ kind, review }: ExistingRequest): ExistingRequestNote {
  const destination = review.mergeRequest?.destination;
  if (kind === 'active') {
    return { text: `This branch already has a merge request into ${destination}:`, request: `#${review.id} ${review.title}`, blocks: `This branch already has a merge request into ${destination}` };
  }
  return { text: `${review.mergeRequest?.state === 'Merged' ? 'Merged' : 'Closed'} before as #${review.id}` };
}

/**
 * What the server made of a request just created, from the first read of it: a server older than merge requests makes
 * a plain code review of what `cm mergerequest create` asks, and says nothing.
 */
export function createdAs(review: Pick<CodeReviewSummary, 'mergeRequest'>): 'mergeRequest' | 'codeReview' {
  return review.mergeRequest ? 'mergeRequest' : 'codeReview';
}
