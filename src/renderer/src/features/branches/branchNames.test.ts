import { describe, expect, it } from 'vitest';
import { validateBranchName } from './branchNames';

describe('validateBranchName', () => {
  it('accepts usual task names', () => {
    expect(validateBranchName('scm-1234_fix.login')).toBeUndefined();
  });

  it('rejects separators, spaces and spec characters', () => {
    expect(validateBranchName('a/b')).toBeDefined();
    expect(validateBranchName('my branch')).toBeDefined();
    expect(validateBranchName('task@repo')).toBeDefined();
  });
});
