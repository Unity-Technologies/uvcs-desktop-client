import { shortBranchName } from '@shared/domain/specs';
import { ELLIPSIS } from './trimToFit';

/**
 * The most characters a branch takes in a sentence, a button or a menu item (`branchLabel`): enough for any name people
 * read at a glance, short enough that two of them and the words around fit a dialog's button or a menu's width.
 */
export const MAX_BRANCH_LABEL_CHARS = 40;

/**
 * A branch named in words (a title, a button, a menu item, a toast): its own name (`merge-test` for
 * `/main/task/merge-test`), cut in its middle past `maxChars` so both ends still tell it apart. Rows, chips and fields
 * that show the branch itself fit the whole path to their width instead (`PathLabel`).
 */
export function branchLabel(fullName: string, maxChars = MAX_BRANCH_LABEL_CHARS): string {
  return cutMiddle(shortBranchName(fullName), maxChars);
}

/** Two branches named in the same words ("Merge merge-test into subtask"): as `branchLabel`, told apart (`distinctBranchNames`). */
export function branchLabels(first: string, second: string, maxChars = MAX_BRANCH_LABEL_CHARS): [string, string] {
  const [firstName, secondName] = distinctBranchNames(first, second);
  return [cutMiddle(firstName, maxChars), cutMiddle(secondName, maxChars)];
}

/**
 * Two branches named as briefly as tells them apart: their last segments (`subtask`, `child_1`), or as many trailing
 * segments as it takes when those are the same (`a/fix`, `b/fix`).
 */
export function distinctBranchNames(first: string, second: string): [string, string] {
  const firstParts = first.split('/').filter(Boolean);
  const secondParts = second.split('/').filter(Boolean);
  const longest = Math.max(firstParts.length, secondParts.length);
  for (let kept = 1; kept < longest; kept++) {
    const [a, b] = [firstParts.slice(-kept).join('/'), secondParts.slice(-kept).join('/')];
    if (a !== b) return [a, b];
  }
  return [first, second];
}

/** `name` with its middle cut out to `maxChars` (the ellipsis included), the start one character longer when uneven. Cuts between code points. */
function cutMiddle(name: string, maxChars: number): string {
  const chars = Array.from(name);
  if (chars.length <= maxChars) return name;
  const kept = maxChars - ELLIPSIS.length;
  return chars.slice(0, Math.ceil(kept / 2)).join('') + ELLIPSIS + chars.slice(chars.length - Math.floor(kept / 2)).join('');
}
