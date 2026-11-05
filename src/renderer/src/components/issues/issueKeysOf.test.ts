import { describe, expect, it } from 'vitest';
import { issueKeysOf, MAX_ISSUES_PER_COMMENT } from './issueKeysOf';

describe('issueKeysOf', () => {
  it('names a comment’s issues once each, in order, and no other reference', () => {
    expect(
      issueKeysOf([
        { kind: 'issue', key: 'VCS-2', bare: false },
        { kind: 'changeset', id: 4 },
        { kind: 'issue', key: 'VCS-1', bare: false },
        { kind: 'issue', key: 'VCS-2', bare: false },
      ]),
    ).toEqual(['VCS-2', 'VCS-1']);
  });

  it('reads at most one request’s worth as the comment shows', () => {
    const many = Array.from({ length: MAX_ISSUES_PER_COMMENT + 20 }, (_, index) => ({ kind: 'issue' as const, key: `VCS-${index + 1}`, bare: false }));
    expect(issueKeysOf(many)).toHaveLength(MAX_ISSUES_PER_COMMENT);
  });
});
