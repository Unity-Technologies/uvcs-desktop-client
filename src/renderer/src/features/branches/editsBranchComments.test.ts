import { describe, expect, it } from 'vitest';
import { editsBranchComments } from './editsBranchComments';

describe('editsBranchComments', () => {
  it.each(['11.0.16.10512', '11.0.17.1'])('lets cm %j edit a branch comment', (version) => {
    expect(editsBranchComments(version)).toBe(true);
  });

  it.each(['11.0.16.10511', '11.0.15.20000'])('keeps cm %j, where editcomment would create a branch, from it', (version) => {
    expect(editsBranchComments(version)).toBe(false);
  });

  it('answers no for a version it cannot read', () => {
    expect(editsBranchComments(undefined)).toBe(false);
  });
});
