import { describe, expect, it } from 'vitest';
import { matchWindow } from './matchWindow';

const SUMMARY = 'Art: merged /main/task-2210: accelerator-v2: delete the old cache';

/** Where the first `needle` ends in what's shown: it must fit the room. */
const endOf = (shown: string, needle: string) => shown.toLowerCase().indexOf(needle) + needle.length;

describe('matchWindow', () => {
  it('leaves a text whose first match is in sight as it is: the row cuts its end', () => {
    expect(matchWindow('Accelerator v2: delete the old cache and more', 'accel', 20)).toBe('Accelerator v2: delete the old cache and more');
    expect(matchWindow('Fix the accelerator', 'accelerator', 20)).toBe('Fix the accelerator');
  });

  it('cuts the start of a text whose first match lies past the room, at a word, so the match shows', () => {
    const shown = matchWindow(SUMMARY, 'accelerator', 32);
    expect(shown.startsWith('…')).toBe(true);
    expect(endOf(shown, 'accelerator')).toBeLessThanOrEqual(32);
    expect(shown).toContain('/main/task-2210: accelerator-v2');
  });

  it('starts at the match itself when even a little of what comes before leaves no room', () => {
    const shown = matchWindow(SUMMARY, 'accelerator', 13);
    expect(shown.startsWith('…accelerator')).toBe(true);
  });

  it('goes by the first of several matches, of any word typed', () => {
    const shown = matchWindow(SUMMARY, 'cache accelerator', 32);
    expect(endOf(shown, 'accelerator')).toBeLessThanOrEqual(32);
  });

  it('never cuts a character in two (an emoji before the match)', () => {
    const text = `${'🎉'.repeat(20)} then the needle`;
    const shown = matchWindow(text, 'needle', 16);
    expect(shown.startsWith('…')).toBe(true);
    expect(shown).toContain('needle');
    expect(/[\uD800-\uDFFF]/.test(shown.replace(/(?:[\uD800-\uDBFF][\uDC00-\uDFFF])/g, ''))).toBe(false);
  });

  it('leaves a text as it is for an empty query, or one it doesn’t hold', () => {
    expect(matchWindow(SUMMARY, '', 10)).toBe(SUMMARY);
    expect(matchWindow(SUMMARY, 'nowhere', 10)).toBe(SUMMARY);
  });
});
