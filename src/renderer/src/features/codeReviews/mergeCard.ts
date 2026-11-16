import type { Branch } from '@shared/domain/branch';
import type { CodeReviewer, CodeReviewStatus, MergeRequestInfo, MergeRequestState } from '@shared/domain/codeReview';
import { MENU_WORDS } from '../../components/menuWords';
import { branchLabel } from '../../lib/branchLabels';
import { pluralize } from '../../lib/text';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { openThreads, threadsOf } from './conversation/reviewThreads';
import type { MergeInto } from './mergeInto';
import type { ConflictsCheck } from './mergeRequestConflicts';
import { mergeRequestMoves, type MergeRequestMove } from './mergeRequestState';

/**
 * Where a section of the merge card stands, its disc's color: passed (the Reviewed color's check), failed (the Rework
 * color's cross), pending or neutral (a quiet ring).
 */
export type MergeCardTone = 'passed' | 'failed' | 'pending' | 'neutral';

/** What a button of the card does; `MergeRequestCard` runs it. Disabled when it says why. */
export type MergeCardAction = { label: string; primary?: boolean; disabledReason?: string } & (
  | { kind: 'move'; move: MergeRequestMove }
  | { kind: 'merge'; merge: MergeInto }
  | { kind: 'addReviewers' }
  | { kind: 'checkConflicts' }
  | { kind: 'setBranchHidden'; branch: string; hidden: boolean }
  | { kind: 'switchTo'; branch: string }
);

/**
 * One section of the merge card: what it's about, where it stands and, at its right, what can be done about it. The
 * card is an ordered list of them, open-ended on purpose: what else decides a merge (its checks, its conflicts with the
 * destination) joins the list as a section of its own, with no change to the card (docs/features/merge-requests.md
 * "The merge card").
 */
export interface MergeCardSection {
  id: 'draft' | 'review' | 'conflicts' | 'merged' | 'closed';
  tone: MergeCardTone;
  /** The state's glyph in its color, instead of the tone's disc: a section that is the state itself. */
  state?: MergeRequestState;
  title: string;
  detail?: string;
  /** Lines under the detail: what's still open on the review. */
  rows?: string[];
  /** The changeset a merge request was merged in, a chip after the title. */
  changeset?: number;
  action?: MergeCardAction;
}

/** The card: its sections, then its footer's button and the moves its ⋯ menu offers. */
export interface MergeCard {
  sections: MergeCardSection[];
  footer?: MergeCardAction;
  menu: MergeCardAction[];
}

export interface MergeCardInput {
  mergeRequest: MergeRequestInfo;
  /** The review's own status, which the server derives from its reviewers'. */
  status: CodeReviewStatus;
  reviewers: readonly CodeReviewer[];
  /** The branch it merges; none when its name couldn't be read. */
  source: string | undefined;
  /** The change requests and questions still open in its conversation. */
  open: OpenItems;
  /** The changeset it was merged in, from its conversation (`mergedChangesetOf`). */
  mergedChangeset?: number;
  /** Its branch as read, for whether it's hidden: null when it no longer exists (deleted, renamed); none until read. */
  sourceBranch?: Pick<Branch, 'isHidden'> | null;
  /** The branch the window's workspace is on; none without a workspace, or on no branch. */
  workspaceBranch?: string;
  /** Its merge, when it can be merged (`mergeOfRequest`, the menus' rule too). */
  merge?: MergeInto;
  /** Whether the window has a workspace: the merge page runs in one. */
  inWorkspace: boolean;
  /** Its conflicts with the destination (`useMergeRequestConflicts`); none where they aren't checked. */
  conflicts?: ConflictsCheck;
}

export interface OpenItems {
  changeRequests: number;
  questions: number;
}

/** What the merge card of a merge request shows (`MergeRequestCard`), by its state. */
export function mergeCardOf(input: MergeCardInput): MergeCard {
  const moves = mergeRequestMoves(input.mergeRequest.state).map(moveAction);
  switch (input.mergeRequest.state) {
    case 'Draft':
      return {
        sections: [{ id: 'draft', tone: 'neutral', state: 'Draft', title: 'Draft', detail: 'Not ready to review or merge yet' }],
        footer: { ...moves[0]!, primary: true },
        menu: moves.slice(1),
      };
    case 'Open': {
      const conflicts = input.conflicts && conflictsSectionOf(input.conflicts, input.mergeRequest.destination, input.merge);
      const sections = [openReviewSection(input), ...(conflicts ? [conflicts] : [])];
      return { sections, ...mergeFooter(input, mergeReadiness(sections)), menu: moves };
    }
    case 'Merged':
      return { sections: [mergedSection(input)], ...switchToDestination(input), menu: [] };
    case 'Closed':
      return { sections: [{ id: 'closed', tone: 'neutral', state: 'Closed', title: 'Closed', detail: 'Not merged' }], footer: moves[0], menu: [] };
  }
}

/**
 * Where the review stands, as the official clients word it, from the reviewers the review was read with: each counts
 * once, a group as one reviewer. A request with no reviewer can't be approved, so it asks for one.
 */
export function reviewSectionOf(reviewers: readonly CodeReviewer[], status: CodeReviewStatus): MergeCardSection {
  if (reviewers.length === 0) {
    return { id: 'review', tone: 'pending', title: 'Review required', detail: 'At least 1 approving review is required', action: { kind: 'addReviewers', label: 'Add reviewers' } };
  }
  const count = (each: CodeReviewStatus): number => reviewers.filter((reviewer) => reviewer.status === each).length;
  switch (status) {
    case 'Reviewed':
      return { id: 'review', tone: 'passed', title: 'Changes reviewed', detail: pluralize(count('Reviewed'), 'approving review') };
    case 'Rework required':
      return { id: 'review', tone: 'failed', title: 'Changes required', detail: `${pluralize(count('Rework required'), 'review')} requesting changes` };
    case 'Under review':
      return { id: 'review', tone: 'pending', title: 'Changes under review', detail: pluralize(count('Under review'), 'pending review') };
  }
}

/**
 * Whether the request merges cleanly into its destination: Check before it's asked, quiet while the server calculates
 * the merge, passed with no conflict. Its file and directory conflicts are counted as the merge page groups them, with
 * **Resolve…**, its merge page: pending when they're only files, as the merge page may merge some automatically (it
 * finds out by merging their text, which the preview can't tell), failed with a directory conflict, which always needs
 * a decision. Nothing when the check failed or there's nothing left to merge.
 */
export function conflictsSectionOf(check: ConflictsCheck, destination: string, merge: MergeInto | undefined): MergeCardSection | undefined {
  const into = branchLabel(destination);
  switch (check.kind) {
    case 'unchecked':
      return { id: 'conflicts', tone: 'neutral', title: `Conflicts with ${into}`, detail: 'Not checked yet', action: { kind: 'checkConflicts', label: 'Check' } };
    case 'checking':
      return { id: 'conflicts', tone: 'neutral', title: `Checking for conflicts with ${into}…` };
    case 'failed':
      return undefined;
    case 'checked': {
      const { status, files, directories } = check.counts;
      if (status !== 'ready') return undefined;
      if (files === 0 && directories === 0) return { id: 'conflicts', tone: 'passed', title: `No conflicts with ${into}`, detail: 'Merging can be done automatically' };
      const counts = [files > 0 && pluralize(files, 'file conflict'), directories > 0 && pluralize(directories, 'directory conflict')].filter(Boolean).join(' and ');
      const one = files + directories === 1;
      const onlyFiles = directories === 0;
      return {
        id: 'conflicts',
        tone: onlyFiles ? 'pending' : 'failed',
        title: `${counts} with ${into}`,
        detail: onlyFiles ? (one ? 'It may merge automatically' : 'Some may merge automatically') : one ? 'Resolve it to merge' : 'Resolve them to merge',
        ...(merge && { action: { kind: 'merge', merge, label: 'Resolve…' } }),
      };
    }
  }
}

/** How many of the conversation's open threads (`openThreads`) are change requests, and how many questions. */
export function openItemsIn(openThreads: readonly { root: { kind: string } }[]): OpenItems {
  const count = (kind: string): number => openThreads.filter((thread) => thread.root.kind === kind).length;
  return { changeRequests: count('changeRequest'), questions: count('question') };
}

/** What a conversation's comments still have open (`threadsOf`, `openThreads`): the top bar's card, read on its own. */
export function openItemsOfConversation(comments: readonly ReviewComment[]): OpenItems {
  return openItemsIn(openThreads(threadsOf(comments)));
}

/** "3 change requests and 1 question open"; none when nothing is. */
export function openItemsLine({ changeRequests, questions }: OpenItems): string | undefined {
  const parts = [changeRequests > 0 && pluralize(changeRequests, 'change request'), questions > 0 && pluralize(questions, 'question')].filter(Boolean);
  return parts.length > 0 ? `${parts.join(' and ')} open` : undefined;
}

/**
 * Whether the request is ready to merge: a section passed and every other passed too, or says nothing yet (neutral: the
 * conflicts not checked, or being checked). The card's Merge is primary then, and quiet before, so that a section
 * (unfinished review, conflicts) holds it back. It never blocks a merge: the server's merge rules decide.
 */
export function mergeReadiness(sections: readonly MergeCardSection[]): boolean {
  return sections.some((section) => section.tone === 'passed') && sections.every((section) => section.tone === 'passed' || section.tone === 'neutral');
}

function openReviewSection(input: MergeCardInput): MergeCardSection {
  const open = openItemsLine(input.open);
  return { ...reviewSectionOf(input.reviewers, input.status), ...(open && { rows: [open] }) };
}

function mergedSection({ mergeRequest, source, mergedChangeset, sourceBranch, workspaceBranch }: MergeCardInput): MergeCardSection {
  const hide = source !== undefined && sourceBranch ? visibilityAction(source, sourceBranch.isHidden === true, workspaceBranch === source) : undefined;
  return {
    id: 'merged',
    tone: 'neutral',
    state: 'Merged',
    title: `Merged into ${mergeRequest.destination}`,
    ...(mergedChangeset !== undefined && { changeset: mergedChangeset }),
    ...(hide && { action: hide }),
  };
}

/**
 * Merge into the destination, on the merge page: primary once ready, else quiet, never disabled for the review (the
 * server's merge rules decide). Disabled only where there's no merge page, a window with no workspace. None when it
 * can't be merged (`mergeOfRequest`: its branch's name couldn't be read).
 */
function mergeFooter({ merge, inWorkspace }: MergeCardInput, ready: boolean): Pick<MergeCard, 'footer'> {
  if (!merge) return {};
  const footer: MergeCardAction = { kind: 'merge', merge, label: merge.label, primary: ready };
  return { footer: inWorkspace ? footer : { ...footer, disabledReason: 'Open a workspace of this repository to merge' } };
}

/** The workspace still on the merged branch: the next step is its destination. */
function switchToDestination({ mergeRequest, source, workspaceBranch }: MergeCardInput): Pick<MergeCard, 'footer'> {
  if (source === undefined || workspaceBranch !== source) return {};
  return { footer: { kind: 'switchTo', branch: mergeRequest.destination, label: `Switch to ${mergeRequest.destination}` } };
}

/**
 * Hide a visible branch, show a hidden one again. Not hiding the branch the workspace is on (`cm` would, and the
 * workspace's own branch would leave the lists): switching away comes first, the card's footer.
 */
function visibilityAction(branch: string, isHidden: boolean, workspaceIsOnIt: boolean): MergeCardAction | undefined {
  if (isHidden) return { kind: 'setBranchHidden', branch, hidden: false, label: 'Unhide branch' };
  return workspaceIsOnIt ? undefined : { kind: 'setBranchHidden', branch, hidden: true, label: 'Hide branch' };
}

function moveAction(move: MergeRequestMove): MergeCardAction {
  // In the menus' words (`menuAction`), so the card and the menus name a move alike.
  return { kind: 'move', move, label: MENU_WORDS[move.word].label ?? move.word };
}
