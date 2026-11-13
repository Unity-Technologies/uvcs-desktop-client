import { describe, expect, it } from 'vitest';
import type { ReviewChangeRequest } from '../codeReviews/changeRequests/changeRequests';
import { changeRequestsButton } from './changeRequestsButtonState';

const request = (commentId: number): ReviewChangeRequest => ({ reviewId: 43, commentId, guid: `g${commentId}`, author: 'ana', date: '', text: 'Fix it', state: { kind: 'open' } });

describe('changeRequestsButton', () => {
  it('shows, with their count, only while the branch has change requests to apply', () => {
    expect(changeRequestsButton({ requests: [request(1), request(2)], reading: false, failed: false })).toEqual({ count: 2, tip: 'Change requests to apply', label: '2 change requests to apply' });
    expect(changeRequestsButton({ requests: [request(1)], reading: false, failed: false })?.label).toBe('1 change request to apply');
  });

  it('stays out of the way with none, while they are read, or when they could not be', () => {
    expect(changeRequestsButton({ requests: [], reading: false, failed: false })).toBeNull();
    expect(changeRequestsButton({ requests: [], reading: true, failed: false })).toBeNull();
    expect(changeRequestsButton({ requests: [], reading: false, failed: true })).toBeNull();
  });
});
