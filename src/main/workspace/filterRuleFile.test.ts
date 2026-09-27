import { describe, expect, it } from 'vitest';
import { withRule } from './filterRuleFile';

describe('withRule', () => {
  it('adds the rule on a line of its own', () => {
    expect(withRule('', 'Library')).toBe('Library\n');
    expect(withRule('Temp\n', 'Library')).toBe('Temp\nLibrary\n');
    expect(withRule('Temp', 'Library')).toBe('Temp\nLibrary\n');
  });

  it('keeps the Windows line breaks of a file written there', () => {
    expect(withRule('Temp\r\nobj\r\n', 'Library')).toBe('Temp\r\nobj\r\nLibrary\r\n');
    expect(withRule('Temp\r\nobj', 'Library')).toBe('Temp\r\nobj\r\nLibrary\r\n');
  });
});
