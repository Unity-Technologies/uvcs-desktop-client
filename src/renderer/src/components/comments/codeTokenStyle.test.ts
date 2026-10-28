import { describe, expect, it } from 'vitest';
import { codeTokenStyle } from './codeTokenStyle';

describe('codeTokenStyle', () => {
  it("draws a token in its theme's color and font style", () => {
    expect(codeTokenStyle({ color: '#d73a49' })).toEqual({ color: '#d73a49' });
    expect(codeTokenStyle({ color: '#6a737d', fontStyle: 1 })).toEqual({ color: '#6a737d', fontStyle: 'italic' });
    expect(codeTokenStyle({ fontStyle: 2 | 4 })).toEqual({ fontWeight: 'bold', textDecoration: 'underline' });
    expect(codeTokenStyle({})).toEqual({});
  });
});
