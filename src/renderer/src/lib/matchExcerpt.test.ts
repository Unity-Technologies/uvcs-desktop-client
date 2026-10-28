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

  it('puts its lines on one line', () => {
    expect(excerptAroundMatch('Title\n\n  Body\r\nmore', 'body').text).toBe('Title Body more');
  });

  it('keeps the start when nothing in it matches', () => {
    expect(excerptAroundMatch('Nothing here', 'missing')).toEqual({ text: 'Nothing here', matches: [] });
  });

  it('cuts a single long word where the context starts', () => {
    const text = `${'x'.repeat(60)}match`;

    expect(excerptAroundMatch(text, 'match').text).toBe(`…${'x'.repeat(24)}match`);
  });
});
