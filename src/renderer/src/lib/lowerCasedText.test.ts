import { describe, expect, it } from 'vitest';
import { lowerCasedText } from './lowerCasedText';

describe('lowerCasedText', () => {
  it('lower-cases a text whose letters keep their length whole, a slice of it the same slice of the text', () => {
    const { lower, originalRange } = lowerCasedText('ΟΔΟΣ Main');

    expect(lower).toBe('οδος main');
    expect(originalRange(5, 9)).toEqual([5, 9]);
  });

  it('finds in the text a slice found after, or across, a letter that grew when lower-cased', () => {
    const text = 'İzmir Ankara';
    const { lower, originalRange } = lowerCasedText(text);

    expect(lower.length).toBe(text.length + 1);
    expect(text.slice(...originalRange(lower.indexOf('ankara'), lower.indexOf('ankara') + 6))).toBe('Ankara');
    expect(text.slice(...originalRange(0, 6))).toBe('İzmir');
    expect(lowerCasedText(text).originalIndex(lower.indexOf('ankara'))).toBe(text.indexOf('Ankara'));
    // Half of what İ became is all of İ in the text.
    expect(originalRange(0, 1)).toEqual([0, 1]);
  });
});
