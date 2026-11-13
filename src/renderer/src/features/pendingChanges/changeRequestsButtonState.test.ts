import { describe, expect, it } from 'vitest';
import type { ReviewChangeRequest } from '../codeReviews/changeRequests/changeRequests';
import { changeRequestsButton } from './changeRequestsButtonState';

const request = (commentId: number): ReviewChangeRequest => ({ reviewId: 43, commentId, guid: `g${commentId}`, author: 'ana', date: '', text: 'Fix it', state: { kind: 'open' } });

describe('changeRequestsButton', () => {
  it('shows, with their count, only while the branch has change requests to offer', () => {
    expect(changeRequestsButton([request(1), request(2)])).toEqual({ count: 2, tip: 'Change requests to apply', label: '2 change requests to apply' });
    expect(changeRequestsButton([request(1)])?.label).toBe('1 change request to apply');
    expect(changeRequestsButton([])).toBeNull();
  });
});
