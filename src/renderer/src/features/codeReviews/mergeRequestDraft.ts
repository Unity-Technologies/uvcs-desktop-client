import type { Branch } from '@shared/domain/branch';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import type { BranchGroup } from '../branches/branchSearchRows';
import { newestBranchesFirst } from '../branches/newestBranchesFirst';
import { ancestorsOf } from './destinationChoices';
import { commentLineText } from '../../lib/comments/commentText';
import { isActiveMergeRequest } from './mergeRequestState';

/*
 * What the new merge request dialog decides (`CreateMergeRequestDialog`): its defaults, what stops it, and what the
 * branch already has (docs/features/merge-requests.md "Creating one").
 */

/** A merge request as its dialog holds it: branch names (`/main/task`) and the title typed. */
export interface MergeRequestDraft {
  source: string;
  /** The source's parent branch once the source is read, none until then: a top-level branch that has one may merge into it. */
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

/**
 * The branch the dialog starts on, from the view or the palette: the workspace's, unless its name says it has nowhere
 * to merge (`/main`, where most workspaces sit), which would open the dialog on a refusal.
 */
export function prefilledSourceOf(workspaceBranch: string | undefined): string | undefined {
  return workspaceBranch && ancestorsOf(workspaceBranch).length > 0 ? workspaceBranch : undefined;
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
  // A top-level name may still have a parent (`/release` from `/main`): until it's read, Create waits, refusing nothing.
  if (sourceParent === undefined && ancestorsOf(source).length === 0) return 'Reading the branch…';
  if (!canMergeSomewhere({ name: source, parent: sourceParent ?? '' })) return 'A top-level branch has no merge request';
  if (!destination) return 'Pick a destination';
  if (source === destination) return "A branch can't merge into itself";
  // `cm` would make it: a request into a branch made from the source, which never takes the task's changes back up.
  if (destination.startsWith(`${source}/`)) return "A branch can't merge into one made from it";
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
 * A line under the dialog's branches: what the branch already has into that destination, or that it couldn't be
 * checked. `request` names a request to open by its title (`Add login`); `blocks` says why Create waits meanwhile (its
 * tooltip), only for one still to merge. Every other note only informs.
 */
export interface DraftNote {
  text: string;
  request?: { label: string; review: CodeReviewSummary };
  blocks?: string;
}

export function existingRequestNote({ kind, review }: ExistingRequest): DraftNote {
  const destination = review.mergeRequest?.destination;
  const request = { label: commentLineText(review.title), review };
  if (kind === 'active') {
    return { text: `This branch already has a merge request into ${destination}:`, request, blocks: `This branch already has a merge request into ${destination}` };
  }
  return { text: `${review.mergeRequest?.state === 'Merged' ? 'Merged' : 'Closed'} before:`, request };
}

/**
 * The read of the branch's reviews while they aren't in hand: still running (`checking`), or failed. A failed check
 * doesn't stop Create: `cm` creates anyway, and a duplicate shows in the list, where it can be closed.
 */
export type ReviewsCheck = 'checking' | 'failed';

/**
 * How the check of a branch's reviews stands: none with no branch, or once they're in hand (a refresh that fails keeps
 * them); else failed, or still running (a pick that hasn't settled yet waits for it too).
 */
export function reviewsCheckOf(source: string, reviewsOfBranch: readonly CodeReviewSummary[] | undefined, failed: boolean): ReviewsCheck | undefined {
  if (!source || reviewsOfBranch) return undefined;
  return failed ? 'failed' : 'checking';
}

const CHECK_FAILED_NOTE: DraftNote = { text: "Couldn't check whether this branch already has a merge request" };

/** Create's tooltip while the branch's reviews are read: Create still runs, and waits for that read before asking. */
const CHECKING_TIP = 'Checking for an existing merge request…';

/** What the dialog holds: the branch picked and, once read, its comment and parent; what the user picked and typed. */
export interface MergeRequestFormInput {
  source: string;
  /** The source as read (a branch list's pick holds it); none until then. */
  sourceBranch?: Pick<Branch, 'comment' | 'parent'>;
  /** The destination picked by hand; none follows the source (`defaultDestinationOf`). */
  picked?: string;
  /** The title as typed, empty included; none follows the source (`defaultTitleOf`). */
  typed?: string;
  /** The source's reviews, once read. */
  reviewsOfBranch?: readonly CodeReviewSummary[];
  /** How their read goes while they aren't in hand; none with no branch to read. */
  reviewsCheck?: ReviewsCheck;
}

/** What the dialog shows from what it holds: its fields, the branch's request into that destination, why Create waits. */
export interface MergeRequestForm {
  destination: string;
  title: string;
  note?: DraftNote;
  /** Why Create can't run yet; none once it can. */
  problem?: string;
  /** Create's tooltip: its problem, else that the check for an existing request runs. */
  tip?: string;
}

/**
 * The dialog's fields: Into and the title follow From until the user picks or types one (a title typed and cleared
 * stays empty); an existing request is known, and blocks Create, only once the branch's reviews are read.
 */
export function mergeRequestForm({ source, sourceBranch, picked, typed, reviewsOfBranch, reviewsCheck }: MergeRequestFormInput): MergeRequestForm {
  const destination = picked ?? defaultDestinationOf(source, sourceBranch?.parent) ?? '';
  const title = typed ?? defaultTitleOf(source, sourceBranch?.comment);
  const existing = reviewsOfBranch && existingRequestOf(reviewsOfBranch, destination);
  const note = existing ? existingRequestNote(existing) : reviewsCheck === 'failed' ? CHECK_FAILED_NOTE : undefined;
  const problem = draftProblem({ source, sourceParent: sourceBranch?.parent, destination, title }) ?? note?.blocks;
  const tip = problem ?? (reviewsCheck === 'checking' ? CHECKING_TIP : undefined);
  return { destination, title, note, problem, tip };
}

/** Whether a request the branch has stops another: one still to merge into the same destination. */
export function blocksCreate(existing: ExistingRequest | undefined): boolean {
  return existing?.kind === 'active';
}

/**
 * What the server made of a request just created, from the first read of it: a server older than merge requests makes
 * a plain code review of what `cm mergerequest create` asks, and says nothing.
 */
export function createdAs(review: Pick<CodeReviewSummary, 'mergeRequest'>): 'mergeRequest' | 'codeReview' {
  return review.mergeRequest ? 'mergeRequest' : 'codeReview';
}
