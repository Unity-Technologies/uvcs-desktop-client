import type { CodeReviewTarget } from '@shared/domain/codeReview';
import type { FileContent } from '@shared/domain/content';
import { fileNameOf } from '../../../lib/text';
import { applyChangeText } from '../../../lib/comments/commentReferences';
import { displayName } from '../../../lib/userName';
import type { BehindBranch } from '../../pendingChanges/checkinBehind';
import { newerRangeInContextOf, newerRangeOf } from '../inline/newerLine';
import { withLinesReplaced } from './replaceLines';
import { FAILED, READING, rangeWords, readValue, type LineRange, type Read, type SuggestedChange } from './suggestedChange';

/**
 * What the decision to apply a suggestion knows (docs/features/code-reviews.md "Applying a suggestion"), all of it
 * read already by the window or free to read (the workspace's file, from the disk).
 */
export interface SuggestionApplyFacts {
  /** The change request is open: neither applied nor discarded. */
  open: boolean;
  /** The window's workspace; null for a repository explored without one. */
  workspacePath: string | null;
  /** The branch the workspace is on (`branchWorkedOn`); null when it's on a changeset, a label or a shelve. */
  workspaceBranch: Read<string | null>;
  /** The branch the review's code is on: its own, or its changeset's; null for a shelve, which is on none. */
  reviewBranch: Read<string | null>;
  /** How far the workspace is behind its branch, as the incoming check last saw (`behindBranch`). */
  behind: BehindBranch | null;
  /** The text of the revision the suggestion was written on. */
  commentedText: Read<string | null>;
  /** The workspace's file. */
  workspaceFile: Read<FileContent>;
  /** The file has pending changes already. */
  pending: boolean;
}

/**
 * Whether a suggestion can be applied, and where: none for a request no longer open (no button at all); unavailable,
 * with why, for the tooltip of a disabled button; or ready, at the lines of the workspace's file that hold the text it
 * was written on, with whether it can be checked in alone (`checkIn.reason`: why not). `commentedText` is what both
 * actions check the file against again right before writing (`suggestionTargetIn`).
 */
export type SuggestionApply =
  | { kind: 'none' }
  | { kind: 'unavailable'; reason: string }
  | { kind: 'ready'; range: LineRange; commentedText: string; checkIn: { reason?: string } };

/** What a suggestion can do, from what's known (`SuggestionApplyFacts`), the first reason it can't winning. */
export function suggestionApplyOf(change: SuggestedChange, facts: SuggestionApplyFacts): SuggestionApply {
  if (!facts.open) return { kind: 'none' };
  const blocked = branchReason(facts);
  if (blocked) return { kind: 'unavailable', reason: blocked };
  const { workspaceFile, commentedText } = facts;
  if (workspaceFile.kind === 'reading' || commentedText.kind === 'reading') return { kind: 'unavailable', reason: CHECKING };
  if (commentedText.kind === 'failed') return { kind: 'unavailable', reason: "The code the suggestion was written on can't be read" };
  if (commentedText.value === null) return { kind: 'unavailable', reason: `${fileNameOf(change.path)} wasn't a text file when the suggestion was written` };
  const target = suggestionTargetIn(change, commentedText.value, workspaceFile.kind === 'read' ? workspaceFile.value : 'failed');
  if (target.kind === 'refused') return { kind: 'unavailable', reason: target.reason };
  const checkIn = facts.pending ? { reason: otherChangesReason(change.path) } : {};
  return { kind: 'ready', range: target.range, commentedText: commentedText.value, checkIn };
}

/** Where a suggestion goes in a workspace file's text, or why it can't go there. */
export type SuggestionTarget = { kind: 'ready'; text: string; range: LineRange } | { kind: 'refused'; reason: string };

/**
 * Where the suggestion's lines are in the workspace's file (`file`, or 'failed' when it couldn't be read): the block
 * of lines it was written on (`commentedText`, the revision's), followed into the file whole, with the line before and
 * after it (`newerRangeInContextOf`: moved is fine; any of its lines changed, or a neighbor, is not, so a lone `}` is
 * never written at another one). Decided as the button shows, and again from a fresh read right before the file is
 * written, as the user may have edited it in between (`writeSuggestion`).
 */
export function suggestionTargetIn(change: SuggestedChange, commentedText: string, file: FileContent | 'failed'): SuggestionTarget {
  const name = fileNameOf(change.path);
  if (file === 'failed') return { kind: 'refused', reason: `${name} isn't in your workspace` };
  const text = editableText(file);
  if (text === null) return { kind: 'refused', reason: `${name} isn't a text file this can change` };
  const range = newerRangeInContextOf(commentedText, text, change);
  if (range) return { kind: 'ready', text, range };
  if (alreadyApplied(change, commentedText, text)) return { kind: 'refused', reason: ALREADY_APPLIED };
  // The lines are there, but not their neighbors: say so, as the lines themselves read as written.
  return { kind: 'refused', reason: newerRangeOf(commentedText, text, change) ? codeAroundChangedReason(change) : codeChangedReason(change) };
}

export const ALREADY_APPLIED = 'Your workspace already has this suggestion';

/**
 * The file holds the suggested lines where the commented ones were, their neighbors as they were: applied to the
 * changes already (Apply to my changes), which would otherwise read as the line having changed. A deletion leaves no
 * line to find, so it reads as changed.
 */
function alreadyApplied(change: SuggestedChange, commentedText: string, text: string): boolean {
  if (change.lines.length === 0) return false;
  const suggested = withLinesReplaced(commentedText, change.firstLine, change.lastLine, change.lines);
  if (suggested === null) return false;
  const suggestedLines = { firstLine: change.firstLine, lastLine: change.firstLine + change.lines.length - 1 };
  return newerRangeInContextOf(suggested, text, suggestedLines) !== null;
}

/** Why a suggestion can't be applied once the lines it was written on changed. */
export function codeChangedReason(change: LineRange): string {
  return `${rangeWords(change)} changed since the suggestion was written`;
}

/** Why a suggestion can't be applied once the lines around it changed, its own being as they were. */
export function codeAroundChangedReason(change: LineRange): string {
  return `The code around ${rangeWords(change).toLowerCase()} changed since the suggestion was written`;
}

/** Why a suggestion can't be checked in alone: a check-in of its file would take the file's other changes too. */
export function otherChangesReason(path: string): string {
  return `${fileNameOf(path)} has other changes, which a check-in of it would take too: apply it to your changes`;
}

function branchReason({ workspacePath, workspaceBranch, reviewBranch, behind }: SuggestionApplyFacts): string | null {
  if (workspacePath === null) return "Open a workspace on the review's branch to apply it";
  if (reviewBranch.kind === 'read' && reviewBranch.value === null) return "A shelve's review: its changes are on no branch to apply them to";
  if (reviewBranch.kind === 'reading' || workspaceBranch.kind === 'reading') return CHECKING;
  if (reviewBranch.kind === 'failed') return "Couldn't tell which branch the review is on";
  if (workspaceBranch.kind === 'failed') return "Couldn't tell which branch your workspace is on";
  const branch = reviewBranch.value!;
  if (workspaceBranch.value !== branch) return `Your workspace isn't on ${branch}: switch to it to apply this`;
  if (behind) return `Your workspace is behind ${branch}: update it first`;
  return null;
}

const CHECKING = 'Checking your workspace…';

/**
 * The branch a review's code is on, to apply its suggestions there: a branch's review's own; a changeset's, its
 * changeset's (`changesetBranch`, read by the page's diff already); none for a shelve, on no branch.
 */
export function reviewBranchOf(target: CodeReviewTarget, changesetBranch: Read<string>): Read<string | null> {
  switch (target.kind) {
    case 'branch':
      return readValue(target.branch);
    case 'changeset':
      return changesetBranch;
    case 'shelve':
      return readValue(null);
    case 'unknown':
      return FAILED;
  }
}

/** How the split button shows a suggestion's state (`SuggestionApplyButton`): whether at all, what's off, and its tooltip. */
export interface SuggestionApplyButtonView {
  shown: boolean;
  /** Both halves: it can't be applied at all. */
  disabled: boolean;
  /** Check in suggestion alone: Apply to my changes, behind the caret, still can. */
  mainDisabled: boolean;
  tip: string;
}

export const CHECK_IN_TIP = 'Check in this file with the suggestion, applying the change request';

export function suggestionApplyButtonOf(apply: SuggestionApply): SuggestionApplyButtonView {
  switch (apply.kind) {
    case 'none':
      return { shown: false, disabled: true, mainDisabled: true, tip: '' };
    case 'unavailable':
      return { shown: true, disabled: true, mainDisabled: true, tip: apply.reason };
    case 'ready':
      return { shown: true, disabled: false, mainDisabled: apply.checkIn.reason !== undefined, tip: apply.checkIn.reason ?? CHECK_IN_TIP };
  }
}

/** What applying a suggestion knows in a window with no workspace: only that, which is why it can't. */
export function factsWithoutWorkspace(open: boolean): SuggestionApplyFacts {
  return { open, workspacePath: null, workspaceBranch: READING, reviewBranch: READING, behind: null, commentedText: READING, workspaceFile: READING, pending: false };
}

/**
 * The text of a workspace file this can change: UTF-8 text the window read whole. Text in another encoding reads with
 * replacement characters (`toFileContent` decodes UTF-8), and writing it back would change every such byte.
 */
function editableText(content: FileContent): string | null {
  if (content.isBinary || content.tooLarge || content.text === undefined) return null;
  return content.text.includes('\uFFFD') ? null : content.text;
}

/**
 * The check-in comment of a suggestion, as Check in suggestion opens it: who suggested it, then, in its description,
 * the change request it applies (`[apply-change:c0d1ce00]`), which `cm` marks applied in the changeset. Not in the
 * summary: its chip reads the request's first line, which a suggestion alone makes a line of code, and a summary that
 * long wraps as the chip draws, moving the dialog's buttons from under the pointer.
 */
export function suggestionCheckinComment(author: string, guid: string): string {
  return `Apply suggestion from ${displayName(author)}\n\n${applyChangeText(guid)}`;
}
