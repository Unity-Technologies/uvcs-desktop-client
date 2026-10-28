import { describe, expect, it } from 'vitest';
import { excerptAroundMatch } from './matchExcerpt';

describe('excerptAroundMatch', () => {
  it('keeps a text whose match is near its start whole, marking every word typed', () => {
    expect(excerptAroundMatch('[CLI]: cm ls: resolve owner names', '[cli] ls')).toEqual({ text: '[CLI]: cm ls: resolve owner names', matches: [0, 1, 2, 3, 4, 10, 11] });
  });

  it('starts a long text a few words before its first match, so a row cut at its end still shows it', () => {
    const text = 'The settings dialog remembers its size and position between sessions, and resolve owner names in one batch';

    expect(excerptAroundMatch(text, 'batch owner')).toEqual({
      text: '…between sessions, and resolve owner names in one batch',
      matches: [31, 32, 33, 34, 35, 50, 51, 52, 53, 54],
    });
  });

  it('starts near the longest word typed, not a short one found inside another word earlier', () => {
    const text = 'The flag stays false when the settings dialog closes, until we resolve owner names in one batch';

    expect(excerptAroundMatch(text, 'ls resolve').text).toBe('…dialog closes, until we resolve owner names in one batch');
  });

  it('ends a long text a little past its start, so a row never holds a whole essay', () => {
    const text = `Resolve ${'owner names '.repeat(40)}`;
    const { text: shown } = excerptAroundMatch(text, 'resolve');

    expect(shown).toHaveLength(201);
    expect(shown.endsWith('…')).toBe(true);
  });

  it('puts its lines on one line', () => {
    expect(excerptAroundMatch('Title\n\n  Body\r\nmore', 'body').text).toBe('Title Body more');
  });

  it('keeps the start when nothing in it matches', () => {
    expect(excerptAroundMatch('Nothing here', 'missing')).toEqual({ text: 'Nothing here', matches: [] });
  });

  it('never cuts inside its first word: a text without a space before the context shows from its start', () => {
    expect(excerptAroundMatch('Resolve owner names in one batch', 'batch').text).toBe('Resolve owner names in one batch');
    expect(excerptAroundMatch(`${'x'.repeat(60)}match`, 'match').text).toBe(`${'x'.repeat(60)}match`);
  });
});
