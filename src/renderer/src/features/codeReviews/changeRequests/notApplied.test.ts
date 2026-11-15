import { describe, expect, it } from 'vitest';
import { changeRequestsNotAppliedText } from './notApplied';

describe('changeRequestsNotAppliedText', () => {
  it('says no request was applied, and why the one named could not be', () => {
    expect(changeRequestsNotAppliedText(['deadbeef'])).toBe('No change request was applied: deadbeef is applied already, or no review has it open.');
  });

  it('names several the same way', () => {
    expect(changeRequestsNotAppliedText(['deadbeef', 'cafebabe'])).toBe('No change request was applied: deadbeef and cafebabe are applied already, or no review has them open.');
    expect(changeRequestsNotAppliedText(['a1', 'b2', 'c3'])).toBe('No change request was applied: a1, b2 and 1 other are applied already, or no review has them open.');
  });

  it('says nothing when every one was applied', () => {
    expect(changeRequestsNotAppliedText([])).toBeNull();
  });
});
