import { describe, expect, it } from 'vitest';
import { otherRepresentationNotice } from './representationComments';

describe('otherRepresentationNotice', () => {
  it("says how many comments the image holds while the code shows, and the way to them", () => {
    expect(otherRepresentationNotice('text', { onText: 3, onImage: 2, asked: null })).toEqual({ text: '2 comments are on the image', action: 'Show image', showing: 'image' });
  });

  it('says so of the code while the image shows', () => {
    expect(otherRepresentationNotice('image', { onText: 1, onImage: 0, asked: null })).toEqual({ text: '1 comment is on the code', action: 'Show code', showing: 'text' });
  });

  it('says nothing when the other way holds none, or outside a review', () => {
    expect(otherRepresentationNotice('text', { onText: 4, onImage: 0, asked: null })).toBeNull();
    expect(otherRepresentationNotice('image', null)).toBeNull();
  });
});
