import { describe, expect, it } from 'vitest';
import { escapeRegExp } from './escapeRegExp';

describe('escapeRegExp', () => {
  it('matches every character a pattern gives a meaning literally', () => {
    const special = '.*+?^${}()|[]\\';
    expect(new RegExp(`^${escapeRegExp(special)}$`).test(special)).toBe(true);
  });

  it('matches a backslash only as itself', () => {
    const pattern = new RegExp(`^${escapeRegExp('a\\d')}$`);
    expect(pattern.test('a\\d')).toBe(true);
    expect(pattern.test('a1')).toBe(false);
  });

  it('leaves plain text as it is', () => {
    expect(escapeRegExp('Original ApplicationName --pwd=')).toBe('Original ApplicationName --pwd=');
  });
});
