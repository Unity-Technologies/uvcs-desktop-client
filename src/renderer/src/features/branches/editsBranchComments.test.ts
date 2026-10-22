import { describe, expect, it } from 'vitest';
import { editsBranchComments } from './editsBranchComments';

describe('editsBranchComments', () => {
  it.each(['11.0.16.10512', '11.0.16.10513', '11.0.17.1', '11.1.0.0', '12.0.0.0', '11.0.16.10512\r\n'])('lets cm %j edit a branch comment', (version) => {
    expect(editsBranchComments(version)).toBe(true);
  });

  it.each(['11.0.16.10511', '11.0.16.9999', '11.0.15.20000', '10.9.99.99999', '1.0.0.0'])('keeps cm %j, where editcomment would create a branch, from it', (version) => {
    expect(editsBranchComments(version)).toBe(false);
  });

  it.each([undefined, '', 'unknown', '11.0.16', '11.0.16.10512.1', '11.0.16.10512-beta'])('answers no for a version it cannot read: %j', (version) => {
    expect(editsBranchComments(version)).toBe(false);
  });
});
