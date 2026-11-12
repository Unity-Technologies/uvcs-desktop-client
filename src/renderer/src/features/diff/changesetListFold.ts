import type { ChangesetListFocus } from '../../components/changesetList/changesetStepListModel';
import { pluralize } from '../../lib/text';
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

/** What the All changes row's fold shows: the number alone ("13", "1000+"), "Changesets" until read; `changesetFoldLabel` names it. */
export function changesetFoldCount(count: number | undefined, limit = BRANCH_CHANGESETS_LIMIT): string {
  if (count === undefined) return 'Changesets';
  return count >= limit ? `${limit}+` : String(count);
}

/**
 * What the All changes row's fold is named, for its tooltip and screen readers: "Changesets" until read, then how many ("13 changesets"; "1000+ changesets"
 * when the read was cut at its limit).
 */
export function changesetFoldLabel(count: number | undefined, limit = BRANCH_CHANGESETS_LIMIT): string {
  if (count === undefined) return 'Changesets';
  return count >= limit ? `${limit}+ changesets` : pluralize(count, 'changeset');
}
