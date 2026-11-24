import { describe, expect, it } from 'vitest';
import { checkAgainLabel, TRY_AGAIN_LABEL, UPDATE_LABEL, USE_INCLUDED_FOR_NOW_LABEL, useInstalledLabel } from './cmScreenLabels';

/** The short words title case leaves in lower case, unless they come first. */
const MINOR_WORDS = new Set(['a', 'an', 'and', 'for', 'in', 'of', 'on', 'or', 'the', 'to']);

/** Whether every word starts in upper case, but the minor ones after the first; a version or "…" counts as written. */
function isTitleCase(label: string): boolean {
  return label.split(' ').every((word, index) => {
    const letter = word.replace(/^[^\p{L}\d]+/u, '').charAt(0);
    if (!/\p{L}/u.test(letter)) return true;
    return index > 0 && MINOR_WORDS.has(word) ? true : letter === letter.toUpperCase();
  });
}

describe('the buttons about the Unity Version Control the app runs', () => {
  it('are in title case, as every button of the app', () => {
    const labels = [TRY_AGAIN_LABEL, UPDATE_LABEL, USE_INCLUDED_FOR_NOW_LABEL, checkAgainLabel(false), checkAgainLabel(true), useInstalledLabel('11.0.16.10700')];
    expect(labels.filter((label) => !isTitleCase(label))).toEqual([]);
    expect(isTitleCase('Use the included version for now')).toBe(false);
  });

  it('name the installed one’s version, and say when they are checking', () => {
    expect(useInstalledLabel('11.0.16.10700')).toBe('Use the Installed Version (11.0.16.10700)');
    expect(checkAgainLabel(false)).toBe('Check Again');
    expect(checkAgainLabel(true)).toBe('Checking…');
  });
});
