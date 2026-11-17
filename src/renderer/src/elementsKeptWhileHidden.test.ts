import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filesUnder, isAppSource } from '@shared/testing/filesUnder';

/**
 * Elements held in state on purpose, not given by a ref: a comment's panel moved into another element and back
 * (`CommentFocusGroup`), whose target the group itself sets and clears.
 */
const NOT_FROM_A_REF = ['components/commentEditor/CommentFocusGroup.tsx'];

describe('elements held in state', () => {
  it('come from useKeptElement, which keeps them while an Activity hides their view', () => {
    // React detaches refs as an `Activity` hides a view kept mounted (`KeptView`): an element a ref set in state goes
    // null, and what's drawn into it (a diff's files and diff) unmounts with all the user left in it.
    const heldInState = /useState<(?:HTML\w*Element|Element|SVG\w*Element)\s*\|\s*null>/;
    const offenders = filesUnder(__dirname, isAppSource)
      .map((file) => relative(__dirname, file).split('\\').join('/'))
      .filter((file) => !NOT_FROM_A_REF.includes(file) && heldInState.test(readFileSync(`${__dirname}/${file}`, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
