import { describe, expect, it } from 'vitest';
import { BRANCH_REVIEWS_BLOCK } from '@shared/domain/codeReview';
import { branchTargetsCondition } from './branchTargetsCondition';

describe('branchTargetsCondition', () => {
  it("ORs the branches' target ids and keeps to branches, as cm find reads it", () => {
    expect(branchTargetsCondition([37])).toBe("(targetid = 37) and targettype = 'branch'");
    expect(branchTargetsCondition([37, 41])).toBe("(targetid = 37 or targetid = 41) and targettype = 'branch'");
  });

  it('takes a block of BRANCH_REVIEWS_BLOCK and no more', () => {
    const block = Array.from({ length: BRANCH_REVIEWS_BLOCK }, (_, index) => index + 1);
    expect(branchTargetsCondition(block)).toContain(`targetid = ${BRANCH_REVIEWS_BLOCK})`);
    expect(() => branchTargetsCondition([...block, 999])).toThrow();
  });

  it('refuses no branch, and anything that is not an id', () => {
    expect(() => branchTargetsCondition([])).toThrow();
    expect(() => branchTargetsCondition([1.5])).toThrow();
  });
});
