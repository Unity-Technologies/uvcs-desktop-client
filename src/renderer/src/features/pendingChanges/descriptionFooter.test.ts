import { describe, expect, it } from 'vitest';
import { descriptionFooterButtons } from './descriptionFooter';

describe('descriptionFooterButtons', () => {
  it('shows Recent comments while there are some, then the change requests to apply with their count', () => {
    expect(descriptionFooterButtons({ recentComments: 3, changeRequests: 2 })).toEqual([
      { kind: 'recentComments', tip: 'Recent comments' },
      { kind: 'changeRequests', tip: 'Change requests to apply', count: 2, label: '2 change requests to apply' },
    ]);
    expect(descriptionFooterButtons({ recentComments: 0, changeRequests: 1 })).toEqual([{ kind: 'changeRequests', tip: 'Change requests to apply', count: 1, label: '1 change request to apply' }]);
    expect(descriptionFooterButtons({ recentComments: 2, changeRequests: 0 })).toEqual([{ kind: 'recentComments', tip: 'Recent comments' }]);
  });

  it('has no footer with nothing to offer: the description is as it always was', () => {
    expect(descriptionFooterButtons({ recentComments: 0, changeRequests: 0 })).toEqual([]);
  });
});
