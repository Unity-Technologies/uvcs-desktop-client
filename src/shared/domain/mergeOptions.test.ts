import { describe, expect, it } from 'vitest';
import { offersCommonAncestor, offersIgnoreMergeTracking } from './mergeOptions';

describe('offersIgnoreMergeTracking', () => {
  it('is offered where cm accepts it: a cherry pick or a subtractive merge, of one changeset or a range', () => {
    expect(offersIgnoreMergeTracking({ kind: 'cherryPick', sourceSpec: 'cs:9' })).toBe(true);
    expect(offersIgnoreMergeTracking({ kind: 'subtractive', sourceSpec: 'cs:9' })).toBe(true);
    expect(offersIgnoreMergeTracking({ kind: 'cherryPick', sourceSpec: 'cs:9', intervalOriginSpec: 'cs:4' })).toBe(true);
  });

  it('is not offered on a regular merge, which cm refuses with it', () => {
    expect(offersIgnoreMergeTracking({ kind: 'merge', sourceSpec: 'br:/main/task' })).toBe(false);
  });
});

describe('offersCommonAncestor', () => {
  it('is offered on a regular merge of a branch, changeset or label, into the workspace or a branch', () => {
    expect(offersCommonAncestor({ kind: 'merge', sourceSpec: 'br:/main/task' })).toBe(true);
    expect(offersCommonAncestor({ kind: 'merge', sourceSpec: 'lb:v1.0' })).toBe(true);
    expect(offersCommonAncestor({ kind: 'merge', sourceSpec: 'br:/main/task', destinationBranch: '/main' })).toBe(true);
  });

  it('is not offered where the ancestor is already chosen: a cherry pick, a subtractive merge, a range', () => {
    expect(offersCommonAncestor({ kind: 'cherryPick', sourceSpec: 'cs:9' })).toBe(false);
    expect(offersCommonAncestor({ kind: 'subtractive', sourceSpec: 'cs:9' })).toBe(false);
    expect(offersCommonAncestor({ kind: 'merge', sourceSpec: 'cs:9', intervalOriginSpec: 'cs:4' })).toBe(false);
  });

  it("is not offered for a shelve, whose base is the ancestor", () => {
    expect(offersCommonAncestor({ kind: 'merge', sourceSpec: 'sh:41' })).toBe(false);
  });
});
