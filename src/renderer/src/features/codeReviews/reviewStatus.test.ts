import { describe, expect, it } from 'vitest';
import { needsReviewerForStatus } from './reviewStatus';

describe('needsReviewerForStatus', () => {
  it('asks for a reviewer only while nobody is assigned', () => {
    expect(needsReviewerForStatus({ assignee: '' })).toBe(true);
    expect(needsReviewerForStatus({ assignee: ' ' })).toBe(true);
    expect(needsReviewerForStatus({ assignee: 'jane.doe@example.com' })).toBe(false);
  });
});
