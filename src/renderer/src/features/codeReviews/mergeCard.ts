import type { CodeReviewer, CodeReviewStatus, MergeRequestInfo, MergeRequestState } from '@shared/domain/codeReview';
import { MENU_WORDS } from '../../components/menuWords';
import { mergeRequestMoves, type MergeRequestMove } from './mergeRequestState';

/**
 * Where a section of the merge card stands, its disc's color: passed (the Reviewed color's check), failed (the Rework
 * color's cross), pending or neutral (a quiet ring).
 */
export type MergeCardTone = 'passed' | 'failed' | 'pending' | 'neutral';

/** What a button of the card does; `MergeRequestCard` runs it. */
export type MergeCardAction = { label: string; primary?: boolean } & (
  | { kind: 'move'; move: MergeRequestMove }
  | { kind: 'addReviewers' }
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
  id: 'draft' | 'review' | 'merged' | 'closed';
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
  /** Whether its branch is hidden; none until known. */
  sourceHidden?: boolean;
  /** The branch the window's workspace is on; none without a workspace, or on no branch. */
  workspaceBranch?: string;
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
    case 'Open':
      return { sections: [openReviewSection(input)], menu: moves };
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
      return { id: 'review', tone: 'passed', title: 'Changes reviewed', detail: counted(count('Reviewed'), 'approving review') };
    case 'Rework required':
      return { id: 'review', tone: 'failed', title: 'Changes required', detail: counted(count('Rework required'), 'review', 'requesting changes') };
    case 'Under review':
      return { id: 'review', tone: 'pending', title: 'Changes under review', detail: counted(count('Under review'), 'pending review') };
  }
}

/** How many of the conversation's open threads (`openThreads`) are change requests, and how many questions. */
export function openItemsIn(openThreads: readonly { root: { kind: string } }[]): OpenItems {
  const count = (kind: string): number => openThreads.filter((thread) => thread.root.kind === kind).length;
  return { changeRequests: count('changeRequest'), questions: count('question') };
}

/** "3 change requests and 1 question open"; none when nothing is. */
export function openItemsLine({ changeRequests, questions }: OpenItems): string | undefined {
  const parts = [changeRequests > 0 && counted(changeRequests, 'change request'), questions > 0 && counted(questions, 'question')].filter(Boolean);
  return parts.length > 0 ? `${parts.join(' and ')} open` : undefined;
}

/**
 * Whether the request is ready to merge: every section passed. The one rule that makes Merge the card's primary
 * action, so a section added later (a check failed, a conflict) holds it back as an unfinished review does. Nothing
 * blocks a merge: the server's merge rules decide.
 */
export function mergeReadiness(sections: readonly MergeCardSection[]): boolean {
  return sections.length > 0 && sections.every((section) => section.tone === 'passed');
}

function openReviewSection(input: MergeCardInput): MergeCardSection {
  const open = openItemsLine(input.open);
  return { ...reviewSectionOf(input.reviewers, input.status), ...(open && { rows: [open] }) };
}

function mergedSection({ mergeRequest, source, mergedChangeset, sourceHidden }: MergeCardInput): MergeCardSection {
  const hide = source !== undefined && sourceHidden !== undefined ? hideAction(source, !sourceHidden) : undefined;
  return {
    id: 'merged',
    tone: 'neutral',
    state: 'Merged',
    title: `Merged into ${mergeRequest.destination}`,
    ...(mergedChangeset !== undefined && { changeset: mergedChangeset }),
    ...(hide && { action: hide }),
  };
}

/** The workspace still on the merged branch: the next step is its destination. */
function switchToDestination({ mergeRequest, source, workspaceBranch }: MergeCardInput): Pick<MergeCard, 'footer'> {
  if (source === undefined || workspaceBranch !== source) return {};
  return { footer: { kind: 'switchTo', branch: mergeRequest.destination, label: `Switch to ${mergeRequest.destination}` } };
}

function hideAction(branch: string, hidden: boolean): MergeCardAction {
  return { kind: 'setBranchHidden', branch, hidden, label: hidden ? 'Hide branch' : 'Unhide branch' };
}

function moveAction(move: MergeRequestMove): MergeCardAction {
  // In the menus' words (`menuAction`), so the card and the menus name a move alike.
  return { kind: 'move', move, label: MENU_WORDS[move.word].label ?? move.word };
}

function counted(count: number, noun: string, after?: string): string {
  return [count, count === 1 ? noun : `${noun}s`, after].filter((part) => part !== undefined).join(' ');
}
