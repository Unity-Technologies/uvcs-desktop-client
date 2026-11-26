import { describe, expect, it } from 'vitest';
import { isReviewModeOn, withReviewMode } from './reviewModeWorkspaces';

const WORKSPACE = 'a0411612-d36e-4eca-b9b5-97acad5969ea';
const OTHER = '5b0c3a52-1d7e-4f0b-9c4f-3e2a8b9d7c61';

describe('withReviewMode', () => {
  it('turns review mode on for one place, once', () => {
    expect(withReviewMode([OTHER], WORKSPACE, true)).toEqual([OTHER, WORKSPACE]);
    expect(withReviewMode([OTHER, WORKSPACE], WORKSPACE, true)).toEqual([OTHER, WORKSPACE]);
  });

  it('turns it off for that place only', () => {
    expect(withReviewMode([OTHER, WORKSPACE], OTHER, false)).toEqual([WORKSPACE]);
    expect(withReviewMode([], OTHER, false)).toEqual([]);
  });
});

describe('isReviewModeOn', () => {
  it('is on for a place kept in the list, and off while its key is still being asked', () => {
    expect(isReviewModeOn([WORKSPACE], WORKSPACE)).toBe(true);
    expect(isReviewModeOn([WORKSPACE], undefined)).toBe(false);
    expect(isReviewModeOn([OTHER], WORKSPACE)).toBe(false);
  });
});
