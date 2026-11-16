import type { Branch } from '@shared/domain/branch';
import type { CodeReviewSummary, MergeRequestInfo } from '@shared/domain/codeReview';
import { MENU_WORDS } from '../../components/menuWords';
import { branchLabels } from '../../lib/branchLabels';
import { commentLineText } from '../../lib/comments/commentText';
import { pluralize } from '../../lib/text';
import type { OpenItems } from '../codeReviews/mergeCard';
import { mergeOfRequest, type MergeInto } from '../codeReviews/mergeInto';
import { currentRequestOf } from '../codeReviews/reviewsByBranch';
import { isActiveMergeRequest, mergeRequestMoves, mergeRequestTip, type MergeRequestMove, type MergeRequestReview } from '../codeReviews/mergeRequestState';
import type { FinishedTask } from './finishedTask';
import { isTaskBranch } from './mergeTaskSummary';

type TaskBranch = Pick<Branch, 'name' | 'parent'>;

export interface TaskNextStepInput {
  /** The workspace's branch, as read; a task branch has a parent. */
  branch: TaskBranch | undefined;
  /** Whether it has changesets of its own; undefined while asking. */
  hasChangesets: boolean | undefined;
  /**
   * Where the server says its head was merged into `mergedCheckDestinationOf`; null when it wasn't, undefined while
   * asking (or not asked yet: the reviews unread).
   */
  mergedInto: number | null | undefined;
  /** Its reviews, newest first (`branchReviewsQuery`); undefined until read, or when they couldn't be. */
  reviewsOfBranch: readonly CodeReviewSummary[] | undefined;
  /** The task merged, here or anywhere, still to show (`finishedTaskFor`). */
  finished: FinishedTask | null;
}

/**
 * The task's next step, what Changes offers on a clean workspace (docs/features/merge.md "Finishing a task" ›
 * "The next step, in Changes"):
 * nothing; what to do now it's merged; create its merge request; or where the request stands: a draft to get ready, a
 * review waiting for its reviewers or asking for rework, a reviewed one to merge. `mergeTask` is the merge into the
 * parent with no request, alone when the reviews couldn't be read.
 */
export type TaskNextStep =
  | { kind: 'none' }
  | { kind: 'finished'; task: FinishedTask }
  | { kind: 'mergeTask'; branch: TaskBranch }
  | { kind: 'create'; branch: TaskBranch }
  | { kind: 'draft' | 'waiting' | 'rework'; request: MergeRequestReview }
  | { kind: 'reviewed'; request: MergeRequestReview; merge: MergeInto };

/**
 * The task's next step. Nothing new shows until its reviews are read: the merged check waits for them
 * (`mergedCheckDestinationOf`), so Create never shows to turn into something else. The request that counts is the
 * newest still to merge (Open or Draft); a closed or merged one doesn't hold Create back.
 */
export function taskNextStepOf({ branch, hasChangesets, mergedInto, reviewsOfBranch, finished }: TaskNextStepInput): TaskNextStep {
  if (finished) return { kind: 'finished', task: finished };
  if (!isTaskBranch(branch) || hasChangesets !== true || mergedInto !== null) return NONE;
  if (!reviewsOfBranch) return { kind: 'mergeTask', branch };
  const request = reviewsOfBranch.find((review): review is MergeRequestReview => isActiveMergeRequest(review));
  if (!request) return { kind: 'create', branch };
  if (request.mergeRequest.state === 'Draft') return { kind: 'draft', request };
  switch (request.status) {
    case 'Under review':
      return { kind: 'waiting', request };
    case 'Rework required':
      return { kind: 'rework', request };
    case 'Reviewed':
      // Always a merge: `mergeOfRequest` asks for an Open request whose branch is named, and this one is both.
      return { kind: 'reviewed', request, merge: mergeOfRequest({ ...request, target: { kind: 'branch', branch: branch.name } })! };
  }
}

const NONE: TaskNextStep = { kind: 'none' };

/**
 * Where the merged check looks for the branch head (`api.merge.mergedInto`): its merge request's destination, the one
 * still to merge or else the one merged (`currentRequestOf`), else its parent, as merging the task goes. None until the
 * reviews are read; the parent when they couldn't be (`reviewsFailed`). None for a branch that is no task.
 */
export function mergedCheckDestinationOf(branch: TaskBranch | undefined, reviewsOfBranch: readonly CodeReviewSummary[] | undefined, reviewsFailed: boolean): string | undefined {
  if (!isTaskBranch(branch)) return undefined;
  if (!reviewsOfBranch) return reviewsFailed ? branch.parent : undefined;
  return currentRequestOf(reviewsOfBranch)?.mergeRequest.destination ?? branch.parent;
}

/**
 * The review whose conversation the step reads, for the change requests still to apply: a request asking for rework
 * with something open (`openIssueCount`), one of the conversations a check-in reads too (`reviewsToRead`), so it's
 * read once for both. None for any other step.
 */
export function conversationToRead(step: TaskNextStep): number | undefined {
  return step.kind === 'rework' && step.request.openIssueCount > 0 ? step.request.id : undefined;
}

/**
 * Which merged check answered (`mergedInto`'s query): the branch, its head and where the head was looked for.
 * `MergeTaskSuggestion` keys the check by it.
 */
export interface MergedCheck {
  branch: string;
  head: number;
  destination: string;
}

/**
 * Whether a merged check asking again may show the previous answer meanwhile: only the destination changed, for the
 * same head (a request created into /main from /main/release/task, or one closed), so the step stays on screen instead
 * of blinking out until the new check answers. A head that moved, or another branch, starts from nothing.
 */
export function keepsPreviousMergedCheck(previous: MergedCheck | undefined, next: MergedCheck): boolean {
  return previous !== undefined && previous.branch === next.branch && previous.head === next.head;
}

/** A button of the next step; `MergeTaskSuggestion` runs it. */
export type TaskNextStepAction = { label: string; primary: boolean } & (
  | { kind: 'create' | 'open' }
  | { kind: 'readyForReview'; move: MergeRequestMove }
  | { kind: 'merge'; merge: MergeInto }
);

/** The request's line: its state's glyph, "#12", its title's first line (cut to fit) and its review in words. */
export interface TaskNextStepLine {
  /** For the state's glyph (`MergeRequestStateIcon`), which names it to a screen reader. */
  mergeRequest: MergeRequestInfo;
  number: string;
  title: string;
  /** "waiting for 2 reviewers", "3 change requests to apply", "reviewed", "draft". */
  status: string;
  /** "Open merge request into /main: Login screen", the title whole. */
  tip: string;
}

/** The merge into the parent with no request (`TaskMergeButton`): the branches as briefly as tells them apart, in full in its tooltip. */
export interface TaskMergeOffer {
  source: string;
  destination: string;
  tip: string;
  /** After the step's own button (Create merge request): a ghost, the way to finish without a request. */
  subdued: boolean;
}

/** What the next step shows: the request's line, its buttons, and the merge into the parent when it's offered. */
export interface TaskNextStepView {
  line?: TaskNextStepLine;
  actions: TaskNextStepAction[];
  taskMerge?: TaskMergeOffer;
}

interface TaskNextStepViewOptions {
  /** Under a list: the single most useful action, quiet and named whole, with no line. */
  quiet: boolean;
  /**
   * Beside another action (after a check-in, by its Copy link): the line, and the single most useful action, so the
   * screen keeps two buttons at most.
   */
  besideAnotherAction?: boolean;
  /** What the request's conversation still has open, once read (the read a check-in makes for the change requests it applies). */
  open?: OpenItems;
}

/**
 * The line and buttons of a step: as calm as the empty state it sits in, one line and at most two buttons, the next
 * move first. Merging the task with no request stays offered beside Create, quiet, while there's room for it.
 */
export function taskNextStepView(step: TaskNextStep, { quiet, besideAnotherAction = false, open }: TaskNextStepViewOptions): TaskNextStepView {
  const single = quiet || besideAnotherAction;
  switch (step.kind) {
    case 'none':
    case 'finished':
      return { actions: [] };
    case 'mergeTask':
      return { actions: [], taskMerge: taskMergeOffer(step.branch, 'Finish the task', false) };
    case 'create': {
      const create: TaskNextStepAction = { kind: 'create', label: 'Create merge request', primary: !quiet };
      return single ? { actions: [create] } : { actions: [create], taskMerge: taskMergeOffer(step.branch, 'Finish the task without a merge request', true) };
    }
  }
  const number = `#${step.request.id}`;
  const actions = actionsOf(step, number, quiet);
  if (quiet) return { actions: [{ ...actions[0]!, primary: false }] };
  return { line: lineOf(step, number, open), actions: besideAnotherAction ? actions.slice(0, 1) : actions };
}

function taskMergeOffer(branch: TaskBranch, what: string, subdued: boolean): TaskMergeOffer {
  const [source, destination] = branchLabels(branch.name, branch.parent);
  return { source, destination, tip: `${what}: merge ${branch.name} into ${branch.parent}`, subdued };
}

type RequestStep = Extract<TaskNextStep, { request: MergeRequestReview }>;

function actionsOf(step: RequestStep, number: string, quiet: boolean): TaskNextStepAction[] {
  const openIt: TaskNextStepAction = { kind: 'open', label: quiet ? `Open merge request ${number}` : 'Open', primary: false };
  switch (step.kind) {
    case 'draft': {
      const label = quiet ? `Mark merge request ${number} ready for review` : (MENU_WORDS.readyForReview.label ?? 'Ready for review');
      // A draft's first move is getting ready for review (`mergeRequestMoves`), as the card's footer offers it.
      return [{ kind: 'readyForReview', label, primary: true, move: mergeRequestMoves('Draft')[0]! }, openIt];
    }
    case 'reviewed':
      return [{ kind: 'merge', label: step.merge.label, primary: true, merge: step.merge }, openIt];
    case 'waiting':
    case 'rework':
      return [openIt];
  }
}

function lineOf(step: RequestStep, number: string, open: OpenItems | undefined): TaskNextStepLine {
  const { request } = step;
  const title = commentLineText(request.title);
  return { mergeRequest: request.mergeRequest, number, title, status: statusWords(step, open), tip: `${mergeRequestTip(request)}: ${title}` };
}

function statusWords(step: RequestStep, open: OpenItems | undefined): string {
  switch (step.kind) {
    case 'draft':
      return 'draft';
    case 'reviewed':
      return 'reviewed';
    case 'rework':
      return open && open.changeRequests > 0 ? `${pluralize(open.changeRequests, 'change request')} to apply` : 'changes required';
    case 'waiting': {
      const { reviewers } = step.request;
      if (reviewers.length === 0) return 'no reviewers yet';
      const waitingFor = reviewers.filter((reviewer) => reviewer.status === 'Under review').length;
      return waitingFor > 0 ? `waiting for ${pluralize(waitingFor, 'reviewer')}` : 'under review';
    }
  }
}
