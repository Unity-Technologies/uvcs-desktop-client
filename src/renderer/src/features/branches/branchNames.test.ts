import { describe, expect, it } from 'vitest';
import { validateBranchName } from './branchNames';

describe('validateBranchName', () => {
  it('accepts usual task names', () => {
    expect(validateBranchName('scm-1234_fix.login')).toBeUndefined();
  });

  it('accepts spaces, as cm does', () => {
    expect(validateBranchName('my branch')).toBeUndefined();
    expect(validateBranchName('fix  login form')).toBeUndefined();
  });

  it('rejects separators, line breaks and spec characters', () => {
    expect(validateBranchName('a/b')).toBeDefined();
    expect(validateBranchName('a\\b')).toBeDefined();
    expect(validateBranchName('task@repo')).toBeDefined();
    expect(validateBranchName('two\nlines')).toBeDefined();
    expect(validateBranchName("it's")).toBeDefined();
  });
});
