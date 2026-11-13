import type { CodeReviewTarget } from '@shared/domain/codeReview';
import type { FileContent } from '@shared/domain/content';
import { fileNameOf } from '../../../lib/text';
import { applyChangeText } from '../../../lib/comments/commentReferences';
import { displayName } from '../../../lib/userName';
import type { BehindBranch } from '../../pendingChanges/checkinBehind';
import { newerLineOf } from '../inline/newerLine';
import type { Read, SuggestedChange } from './suggestedChange';

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
 * with why, for the tooltip of a disabled button; or ready, at the workspace file's line that holds the text it was
 * written on, with whether it can be checked in alone (`checkIn.reason`: why not).
 */
export type SuggestionApply =
  | { kind: 'none' }
  | { kind: 'unavailable'; reason: string }
  | { kind: 'ready'; text: string; firstLine: number; lastLine: number; checkIn: { reason?: string } };

/** What a suggestion can do, from what's known (`SuggestionApplyFacts`), the first reason it can't winning. */
export function suggestionApplyOf(change: SuggestedChange, facts: SuggestionApplyFacts): SuggestionApply {
  if (!facts.open) return { kind: 'none' };
  const blocked = branchReason(facts);
  if (blocked) return { kind: 'unavailable', reason: blocked };
  const { workspaceFile, commentedText } = facts;
  const name = fileNameOf(change.path);
  if (workspaceFile === 'reading' || commentedText === 'reading') return { kind: 'unavailable', reason: 'Checking your workspace…' };
  if (workspaceFile === 'failed') return { kind: 'unavailable', reason: `${name} isn't in your workspace` };
  const text = editableText(workspaceFile);
  if (text === null) return { kind: 'unavailable', reason: `${name} isn't a text file this can change` };
  const line = commentedText === 'failed' || commentedText === null ? null : newerLineOf(commentedText, text, change.firstLine);
  if (line === null) return { kind: 'unavailable', reason: `Line ${change.firstLine} changed since the suggestion was written` };
  const lastLine = line + (change.lastLine - change.firstLine);
  const checkIn = facts.pending ? { reason: `${name} has other changes, which a check-in of it would take too: apply it to your changes` } : {};
  return { kind: 'ready', text, firstLine: line, lastLine, checkIn };
}

function branchReason({ workspacePath, workspaceBranch, reviewBranch, behind }: SuggestionApplyFacts): string | null {
  if (workspacePath === null) return 'Open a workspace on the review\'s branch to apply it';
  if (reviewBranch === null) return "A shelve's review: its changes are on no branch to apply them to";
  if (reviewBranch === 'reading' || workspaceBranch === 'reading') return 'Checking your workspace…';
  if (reviewBranch === 'failed' || workspaceBranch === 'failed') return "Couldn't tell which branch the review is on";
  if (workspaceBranch !== reviewBranch) return `Your workspace isn't on ${reviewBranch}: switch to it to apply this`;
  if (behind) return `Your workspace is behind ${reviewBranch}: update it first`;
  return null;
}

/**
 * The branch a review's code is on, to apply its suggestions there: a branch's review's own; a changeset's, its
 * changeset's (`changesetBranch`, read by the page's diff already); none for a shelve, on no branch.
 */
export function reviewBranchOf(target: CodeReviewTarget, changesetBranch: Read<string>): Read<string | null> {
  switch (target.kind) {
    case 'branch':
      return target.branch;
    case 'changeset':
      return changesetBranch;
    case 'shelve':
      return null;
    case 'unknown':
      return 'failed';
  }
}

/** What applying a suggestion knows in a window with no workspace: only that, which is why it can't. */
export function factsWithoutWorkspace(open: boolean): SuggestionApplyFacts {
  return { open, workspacePath: null, workspaceBranch: 'reading', reviewBranch: 'reading', behind: null, commentedText: 'reading', workspaceFile: 'reading', pending: false };
}

/**
 * The text of a workspace file this can change: UTF-8 text the window read whole. Text in another encoding reads with
 * replacement characters (`toFileContent` decodes UTF-8), and writing it back would change every such byte.
 */
function editableText(content: FileContent): string | null {
  if (content.isBinary || content.tooLarge || content.text === undefined) return null;
  return content.text.includes('�') ? null : content.text;
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
