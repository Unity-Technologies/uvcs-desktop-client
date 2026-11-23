import { describe, expect, it } from 'vitest';
import { askToTake, otherRepresentationNotice, shownRepresentation } from './representationComments';

describe('otherRepresentationNotice', () => {
  it("says how many comments the image holds while the code shows, and the way to them", () => {
    expect(otherRepresentationNotice('text', 'image', { onText: 3, onRendered: 2, asked: null })).toEqual({ text: '2 comments are on the image', action: 'Show image', showing: 'rendered' });
  });

  it('says so of the code while the image shows', () => {
    expect(otherRepresentationNotice('rendered', 'image', { onText: 1, onRendered: 0, asked: null })).toEqual({ text: '1 comment is on the code', action: 'Show code', showing: 'text' });
  });

  it("names a 3D model as what an OBJ draws", () => {
    expect(otherRepresentationNotice('text', 'model', { onText: 0, onRendered: 1, asked: null })).toEqual({ text: '1 comment is on the model', action: 'Show model', showing: 'rendered' });
  });

  it('says nothing when the other way holds none, or outside a review', () => {
    expect(otherRepresentationNotice('text', 'image', { onText: 4, onRendered: 0, asked: null })).toBeNull();
    expect(otherRepresentationNotice('rendered', 'image', null)).toBeNull();
  });
});

describe('askToTake', () => {
  it('takes an ask once', () => {
    const asked = { representation: 'rendered' as const, key: '41:4' };
    expect(askToTake(asked, null)).toBe(asked);
    expect(askToTake(asked, '41:4')).toBeNull();
    expect(askToTake(null, '41:3')).toBeNull();
  });

  it("takes another review's ask though its own counter gave it the same number", () => {
    expect(askToTake({ representation: 'rendered', key: '42:1' }, '41:1')).not.toBeNull();
  });
});

describe('shownRepresentation', () => {
  it("shows the view asked for the versions shown, else the user's for the type", () => {
    const override = { versionsKey: 'a', representation: 'image' };
    expect(shownRepresentation('text', override, 'a')).toBe('image');
    expect(shownRepresentation('text', override, 'b')).toBe('text');
    expect(shownRepresentation('text', null, 'a')).toBe('text');
  });
});
