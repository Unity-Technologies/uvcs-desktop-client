import { describe, expect, it } from 'vitest';
import { DESCRIPTION_FOOTER_HEIGHT, descriptionFooterButtons, descriptionHeightWith, recentCommentsMenuItems } from './descriptionFooterButtons';

describe('recentCommentsMenuItems', () => {
  it('lists each comment by its first line, to pick', () => {
    expect(recentCommentsMenuItems({ offered: true, comments: ['Fix the jump\n\nIt was too high', 'Tune cs:4207'], waiting: null })).toEqual([
      { label: 'Fix the jump', comment: 'Fix the jump\n\nIt was too high', disabled: false },
      { label: 'Tune cs:4207', comment: 'Tune cs:4207', disabled: false },
    ]);
  });

  it('shows what the menu waits for, disabled, in place of the comments', () => {
    expect(recentCommentsMenuItems({ offered: true, comments: [], waiting: 'Loading…' })).toEqual([{ label: 'Loading…', disabled: true }]);
  });
});

describe('descriptionFooterButtons', () => {
  it('shows Recent comments while there are some, then the change requests to apply with their count', () => {
    expect(descriptionFooterButtons({ recentComments: true, changeRequests: 2 })).toEqual([
      { kind: 'recentComments', tip: 'Recent comments' },
      { kind: 'changeRequests', tip: 'Change requests to apply', count: 2, label: '2 change requests to apply' },
    ]);
    expect(descriptionFooterButtons({ recentComments: false, changeRequests: 1 })).toEqual([{ kind: 'changeRequests', tip: 'Change requests to apply', count: 1, label: '1 change request to apply' }]);
    expect(descriptionFooterButtons({ recentComments: true, changeRequests: 0 })).toEqual([{ kind: 'recentComments', tip: 'Recent comments' }]);
  });

  it('makes the description taller by the footer while it shows, so the footer takes none of the room to type', () => {
    expect(descriptionHeightWith(80, [{ kind: 'recentComments', tip: 'Recent comments' }])).toBe(80 + DESCRIPTION_FOOTER_HEIGHT);
    expect(descriptionHeightWith(80, [])).toBe(80);
  });

  it('has no footer with nothing to offer: the description is as it always was', () => {
    expect(descriptionFooterButtons({ recentComments: false, changeRequests: 0 })).toEqual([]);
  });
});
