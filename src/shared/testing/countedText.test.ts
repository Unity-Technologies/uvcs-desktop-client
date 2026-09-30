import { describe, expect, it } from 'vitest';
import { countedText } from './countedText';

describe('countedText', () => {
  it('counts the characters read from the text it stands in for, and all of it when joined to another', () => {
    const { text, charactersRead } = countedText('abcdef');

    expect(text.slice(-2)).toBe('ef');
    expect(charactersRead()).toBe(2);
    expect(`${'x'}${text}`).toBe('xabcdef');
    expect(charactersRead()).toBe(2 + 6);
  });
});
