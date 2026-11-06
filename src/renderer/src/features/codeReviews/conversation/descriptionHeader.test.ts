import { describe, expect, it } from 'vitest';
import { descriptionHeader } from './descriptionHeader';

const review = { owner: 'ana', date: '2026-11-06T10:00:00+01:00' };

describe('descriptionHeader', () => {
  it('reads who wrote the description and when, and what it says', () => {
    expect(descriptionHeader(review, { guid: 'd', text: 'Why', author: 'bob', date: '2026-11-06T11:00:00+01:00', editedDate: '2026-11-06T12:00:00+01:00' })).toEqual({
      author: 'bob',
      action: 'wrote the description',
      date: '2026-11-06T11:00:00+01:00',
      editedDate: '2026-11-06T12:00:00+01:00',
      editLabel: 'Edit description',
      text: 'Why',
    });
  });

  it("offers to write the first one on a review with none, as its author when it was created", () => {
    expect(descriptionHeader(review, undefined)).toEqual({ author: 'ana', action: 'opened the review', date: review.date, editLabel: 'Add a description' });
  });

  it('says nothing for a description emptied, still offering to edit it', () => {
    expect(descriptionHeader(review, { guid: 'd', text: '  \n', author: 'bob', date: review.date })).toEqual({ author: 'bob', action: 'opened the review', date: review.date, editLabel: 'Edit description' });
  });
});
