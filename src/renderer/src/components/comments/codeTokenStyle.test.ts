import { describe, expect, it } from 'vitest';
import { codeTokenStyle, fenceLanguage } from './codeTokenStyle';

describe('codeTokenStyle', () => {
  it("draws a token in its theme's color and font style", () => {
    expect(codeTokenStyle({ color: '#d73a49' })).toEqual({ color: '#d73a49' });
    expect(codeTokenStyle({ color: '#6a737d', fontStyle: 1 })).toEqual({ color: '#6a737d', fontStyle: 'italic' });
    expect(codeTokenStyle({ fontStyle: 2 | 4 })).toEqual({ fontWeight: 'bold', textDecoration: 'underline' });
    expect(codeTokenStyle({})).toEqual({});
  });
});

describe('fenceLanguage', () => {
  it("reads the language a fence names, in lower case, without what follows it", () => {
    expect(fenceLanguage('CSharp')).toBe('csharp');
    expect(fenceLanguage('ts title="a.ts"')).toBe('ts');
    expect(fenceLanguage('  ')).toBeNull();
    expect(fenceLanguage(undefined)).toBeNull();
  });
});
