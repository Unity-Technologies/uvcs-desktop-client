import { describe, expect, it } from 'vitest';
import { countCharactersRead } from './countCharactersRead';

describe('countCharactersRead', () => {
  it('counts what each string method reads, on the input and on every piece cut from it', () => {
    const text = 'name=value;next';
    const { result, charactersRead } = countCharactersRead(() => {
      const end = text.indexOf(';'); // 11 characters looked at
      const pair = text.slice(0, end); // 10 returned
      return pair.charCodeAt(0) + pair.split('=').length; // 1, then the whole piece: 10
    });
    expect(result).toBe('n'.charCodeAt(0) + 2);
    expect(charactersRead).toBe(11 + 10 + 1 + 10);
  });

  it('puts the string methods back, even when the run fails', () => {
    const indexOf = String.prototype.indexOf;
    expect(() =>
      countCharactersRead(() => {
        throw new Error('parse error');
      }),
    ).toThrow('parse error');
    expect(String.prototype.indexOf).toBe(indexOf);
  });
});
