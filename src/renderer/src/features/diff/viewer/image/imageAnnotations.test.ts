import { describe, expect, it } from 'vitest';
import { takesComments } from './imageAnnotations';

describe('takesComments', () => {
  it('offers comments where the place takes them on a side the viewer shows', () => {
    expect(takesComments({ commentsOn: 'new' }, { old: 1, new: 1 })).toBe(true);
    expect(takesComments({ commentsOn: 'old' }, { old: 1, new: null })).toBe(true);
  });

  it("offers none outside a review, or on a side that isn't shown", () => {
    expect(takesComments(null, { new: 1 })).toBe(false);
    expect(takesComments({ commentsOn: null }, { new: 1 })).toBe(false);
    expect(takesComments({ commentsOn: 'new' }, { old: 1, new: null })).toBe(false);
  });
});
