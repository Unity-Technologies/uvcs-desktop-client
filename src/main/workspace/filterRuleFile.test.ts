import { describe, expect, it } from 'vitest';
import { withRules } from './filterRuleFile';

describe('withRules', () => {
  it('adds each rule on a line of its own', () => {
    expect(withRules('', ['Library'])).toBe('Library\n');
    expect(withRules('Temp\n', ['Library'])).toBe('Temp\nLibrary\n');
    expect(withRules('Temp', ['Library', '/Assets/Big'])).toBe('Temp\nLibrary\n/Assets/Big\n');
  });

  it('keeps the Windows line breaks of a file written there', () => {
    expect(withRules('Temp\r\nobj\r\n', ['Library'])).toBe('Temp\r\nobj\r\nLibrary\r\n');
    expect(withRules('Temp\r\nobj', ['Library', 'Logs'])).toBe('Temp\r\nobj\r\nLibrary\r\nLogs\r\n');
  });

  it('leaves out the rules the file already holds, and repeated ones', () => {
    expect(withRules('Temp\r\nLibrary\r\n', ['Library', 'Logs', 'Logs'])).toBe('Temp\r\nLibrary\r\nLogs\r\n');
    expect(withRules('Temp', ['Temp'])).toBe('Temp');
  });
});
