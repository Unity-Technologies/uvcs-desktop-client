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

  // What cm refuses, then what a Windows folder name refuses (a task workspace's folder is named after its branch).
  it.each(['@', '#', '/', ':', '"', '?', "'", '\n', '\r', '\\', '<', '>', '|', '*', '\t'])('rejects %j', (character) => {
    expect(validateBranchName(`a${character}b`)).toBeDefined();
  });
});
