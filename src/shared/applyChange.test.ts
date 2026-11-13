import { describe, expect, it } from 'vitest';
import { withoutApplyChanges } from './applyChange';

const A = '[apply-change:deadbeef]';
const B = '[apply-change:cafebabe]';

describe('withoutApplyChanges', () => {
  it('keeps one space between the words around a reference in the middle of a line', () => {
    expect(withoutApplyChanges(`Fixed the undo ${A} before shelving`)).toBe('Fixed the undo before shelving');
  });

  it("leaves no space at a line's start or end", () => {
    expect(withoutApplyChanges(`${A} Fixed`)).toBe('Fixed');
    expect(withoutApplyChanges(`Fixed ${A}`)).toBe('Fixed');
  });

  it('takes away two in a row at the start, the middle or the end alike', () => {
    expect(withoutApplyChanges(`${A} ${B} text`)).toBe('text');
    expect(withoutApplyChanges(`one ${A} ${B} two`)).toBe('one two');
    expect(withoutApplyChanges(`text ${A} ${B}`)).toBe('text');
  });

  it('takes away a line left empty, so the paragraph around it stays one', () => {
    expect(withoutApplyChanges(`Summary\n\nFirst line\n${A}\nSecond line`)).toBe('Summary\n\nFirst line\nSecond line');
    expect(withoutApplyChanges(`Summary\n\n${A} ${B}`)).toBe('Summary\n');
  });

  it('keeps Windows line ends as they are', () => {
    expect(withoutApplyChanges(`Fixed ${A}\r\n${B}\r\nNext ${A} line`)).toBe('Fixed\r\nNext line');
  });

  it('takes a reference in capitals away too: cm reads it, and would fail the check-in on it', () => {
    expect(withoutApplyChanges('Fixed [APPLY-CHANGE:DEADBEEF] it')).toBe('Fixed it');
  });
});
