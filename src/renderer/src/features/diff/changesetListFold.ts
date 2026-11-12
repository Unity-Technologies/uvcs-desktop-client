import type { ChangesetListFocus } from '../../components/changesetList/changesetStepListModel';
import { BRANCH_CHANGESETS_LIMIT } from './branchDiffChangesets';

/**
 * Whether a branch diff's changesets show, or fold to one line above the files: open when the user left it open
 * (`remembered`, across branches and sessions) or the page asked for changesets (`asked`: what's new since a review, a
 * changeset chip, where a comment was written). Folded, the branch diff reads like its whole-branch view and reads no
 * changesets: who reviews the whole branch sees no list and pays no `cm find`.
 */
export interface ChangesetListFold {
  remembered: boolean;
  asked: boolean;
}

export function listIsOpen(fold: ChangesetListFold): boolean {
  return fold.remembered || fold.asked;
}

/** Whether what the page asks the list to select opens it: anything but all the changes. */
export function askedOpen(focus: ChangesetListFocus): boolean {
  return focus.kind !== 'all';
}

/**
 * The fold after its line is clicked: opened, remembered; folded, remembered too, and back on all the changes
 * (`showsAll`), since a changeset selected out of sight would leave the diff showing what the line doesn't say.
 */
export function toggledFold(fold: ChangesetListFold): { fold: ChangesetListFold; showsAll: boolean } {
  if (listIsOpen(fold)) return { fold: { remembered: false, asked: false }, showsAll: true };
  return { fold: { remembered: true, asked: fold.asked }, showsAll: false };
}

/** The fold's line: "Changesets", and how many once read ("Changesets · 13"; "1000+" when the read was cut there). */
export function changesetFoldLabel(count: number | undefined, limit = BRANCH_CHANGESETS_LIMIT): string {
  if (count === undefined) return 'Changesets';
  return `Changesets · ${count >= limit ? `${limit}+` : count}`;
}
